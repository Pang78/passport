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
    fileSize: 5 * 1024 * 1024, // Reduce to 5MB for safety
    files: 1 // Only allow single file upload
  },
  fileFilter: (_, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Optimized image processing pipeline
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
      cache: false
    });

    const metadata = await pipeline.metadata();
    
    const result = {
      processed: await pipeline
        .resize(800, 800, { 
          fit: 'inside',
          withoutEnlargement: true,
          kernel: sharp.kernel.lanczos2
        })
        .jpeg({ 
          quality: 60,
          progressive: true,
          mozjpeg: true,
          optimizeScans: true
        })
        .toBuffer(),
      metadata
    };

    imageCache.set(hash, result);
    
    // Limit cache size
    if (imageCache.size > 100) {
      const firstKey = imageCache.keys().next().value;
      imageCache.delete(firstKey);
    }

    return result;
  } finally {
    buffer = Buffer.alloc(0);
  }
}

export function registerRoutes(app: Express): Server {
  // Add safety headers
  app.use((_, res, next) => {
    res.header('Content-Type', 'application/json; charset=utf-8');
    res.header('X-Content-Type-Options', 'nosniff');
    next();
  });

  app.post("/api/extract-passport", upload.single("image"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No image provided" });

      // Process with memory safety
      const { processed, metadata } = await safeProcessImage(req.file.buffer);

      if (processed.length > 2 * 1024 * 1024) { // 2MB final check
        return res.status(413).json({ error: "Image too large after processing" });
      }

      // Use thumbnail for response
      const thumbnail = await sharp(processed)
        .resize(300, 300)
        .jpeg({ quality: 50 })
        .toBuffer();

      const passportData = await extractPassportData(processed.toString("base64"));

      res.json({
        ...passportData,
        metadata: {
          dimensions: { 
            width: metadata.width, 
            height: metadata.height 
          },
          size: processed.length
        },
        thumbnail: `data:image/jpeg;base64,${thumbnail.toString("base64")}`
      });

    } catch (error: any) {
      res.status(500).json({ 
        error: "Processing failed",
        details: error.message.slice(0, 100) // Limit error exposure
      });
    }
  });

  app.post("/api/check-quality", upload.single("image"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No image provided" });

      // Create optimized preview for AI analysis
      const preview = await sharp(req.file.buffer)
        .resize(800, 800)
        .jpeg({ quality: 60 })
        .toBuffer();

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "Analyze passport photo quality. Respond with JSON: { isValid: boolean, issues: string[] }"
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
      if (!content) throw new Error("Empty AI response");

      res.json(JSON.parse(content));

    } catch (error: any) {
      res.status(500).json({
        error: "Quality check failed",
        details: error.message.includes("rate limit") 
          ? "Server busy, please try again later"
          : "Internal error"
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}