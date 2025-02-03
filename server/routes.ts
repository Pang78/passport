import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { extractPassportData } from "../client/src/lib/openai";
import sharp from "sharp";
import { OpenAI } from "openai";
import crypto from "crypto";

const openai = new OpenAI();

// Configure multer with safe limits
const upload = multer({
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1
  },
  fileFilter: (_, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG and WebP images are allowed'));
    }
  }
});

// Optimized image processing with LRU cache
const MAX_CACHE_SIZE = 50;
const imageCache = new Map<string, { processed: Buffer; metadata: sharp.Metadata }>();

async function safeProcessImage(buffer: Buffer): Promise<{ processed: Buffer; metadata: sharp.Metadata }> {
  const hash = crypto.createHash('md5').update(buffer).digest('hex');

  if (imageCache.has(hash)) {
    return imageCache.get(hash)!;
  }

  try {
    const pipeline = sharp(buffer, { 
      limitInputPixels: 25_000_000,
      sequentialRead: true,
    }).rotate();

    const metadata = await pipeline.metadata();

    if (!metadata.width || !metadata.height || 
        metadata.width > 5000 || metadata.height > 5000) {
      throw new Error('Invalid image dimensions');
    }

    const result = {
      processed: await pipeline
        .resize(800, 800, { 
          fit: 'inside',
          withoutEnlargement: true,
          kernel: sharp.kernel.lanczos2
        })
        .jpeg({ 
          quality: 75,
          progressive: true,
          mozjpeg: true,
          optimizeScans: true
        })
        .toBuffer(),
      metadata
    };

    // Implement LRU cache
    if (imageCache.size >= MAX_CACHE_SIZE) {
      const firstKey = Array.from(imageCache.keys())[0];
      if (firstKey) imageCache.delete(firstKey);
    }
    imageCache.set(hash, result);

    return result;
  } catch (error) {
    throw new Error(`Image processing failed: ${(error as Error).message}`);
  } finally {
    // Clear the input buffer
    buffer = Buffer.alloc(0);
  }
}

export function registerRoutes(app: Express): Server {
  // Security headers
  app.use((_, res, next) => {
    res.header('Content-Type', 'application/json; charset=utf-8');
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Frame-Options', 'DENY');
    res.header('X-XSS-Protection', '1; mode=block');
    next();
  });

  app.post("/api/extract-passport", upload.single("image"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image provided" });
      }

      const { processed, metadata } = await safeProcessImage(req.file.buffer);

      if (processed.length > 2 * 1024 * 1024) {
        return res.status(413).json({ error: "Image too large after processing" });
      }

      // Generate optimized thumbnail
      const thumbnail = await sharp(processed)
        .resize(300, 300, { fit: 'inside' })
        .jpeg({ quality: 60 })
        .toBuffer();

      const passportData = await extractPassportData(processed.toString("base64"));

      res.json({
        ...passportData,
        metadata: {
          dimensions: { 
            width: metadata.width ?? 0, 
            height: metadata.height ?? 0
          },
          format: metadata.format,
          size: processed.length
        },
        thumbnail: `data:image/jpeg;base64,${thumbnail.toString("base64")}`
      });

    } catch (error: any) {
      console.error('Passport extraction error:', error);
      res.status(500).json({ 
        error: "Processing failed",
        details: error.message.slice(0, 100)
      });
    }
  });

  app.post("/api/check-quality", upload.single("image"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image provided" });
      }

      const preview = await sharp(req.file.buffer)
        .resize(800, 800, { fit: 'inside' })
        .jpeg({ quality: 75 })
        .toBuffer();

      const response = await openai.chat.completions.create({
        model: "gpt-4-vision-preview",
        messages: [
          {
            role: "system",
            content: `Analyze passport photo quality. Check for:
- Document type (must be a passport)
- Image clarity and lighting
- Document alignment and orientation
- Glare or reflections
- Complete document visibility

Respond with JSON: { isValid: boolean, issues: string[] }. Provide specific, user-friendly issues.`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Evaluate this passport photo for data extraction suitability:"
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${preview.toString("base64")}`
                }
              }
            ],
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 200,
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error("Empty AI response");
      }

      res.json(JSON.parse(content));

    } catch (error: any) {
      console.error('Quality check error:', error);
      res.status(error.status || 500).json({
        error: "Quality check failed",
        details: error.message.includes("rate limit") 
          ? "Service is temporarily busy, please try again in a few moments"
          : "Internal processing error"
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}