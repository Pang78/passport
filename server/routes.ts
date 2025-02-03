import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { extractPassportData } from "../client/src/lib/openai";
import sharp from "sharp";
import { OpenAI } from "openai";
import crypto from "crypto";
import { createObjectCsvWriter } from "csv-writer";
import pdf2pic from "pdf2pic";

const openai = new OpenAI();

// Configure multer for both image and PDF uploads
const upload = multer({
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1
  },
  fileFilter: (_, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WebP images and PDF files are allowed'));
    }
  }
});

// Existing image processing code
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

async function processPdfPassport(buffer: Buffer): Promise<Array<any>> {
  try {
    const fs = await import('fs/promises');
    await fs.mkdir('./exports', { recursive: true });
    
    const pdfParse = (await import('pdf-parse')).default;
    const pdfData = await pdfParse(buffer);
    
    const pdf2pic = await import('pdf2pic');
    const converter = new pdf2pic.FromBuffer({
      density: 300,
      format: "png",
      width: 2000,
      height: 2000,
      savePath: "./exports"
    });

    const extractedData = [];

    for (let pageNum = 1; pageNum <= pdfData.numpages; pageNum++) {
      try {
        const result = await converter(pageNum);
        if (!result || !result.base64) {
          console.error(`Failed to convert page ${pageNum}`);
          continue;
        }

        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "Extract passport information from this image. Return a JSON object with fields: documentNumber, surname, givenNames, dateOfBirth, dateOfExpiry, nationality, sex."
            },
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/png;base64,${result.base64}`
                  }
                }
              ]
            }
          ],
          max_tokens: 1000
        });

        if (response.choices[0].message.content) {
          try {
            const parsedData = JSON.parse(response.choices[0].message.content);
            extractedData.push(parsedData);
          } catch (parseError) {
            console.error('Failed to parse OpenAI response:', parseError);
          }
        }
      } catch (pageError) {
        console.error(`Error processing page ${pageNum}:`, pageError);
      }
    }

    // Cleanup temp files
    try {
      const files = await fs.readdir('./exports');
      await Promise.all(
        files
          .filter(f => f.startsWith('temp'))
          .map(f => fs.unlink(`./exports/${f}`))
      );
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError);
    }

    return extractedData;
  } catch (error) {
    console.error('PDF processing error:', error);
    throw new Error('Failed to process PDF document');
  }
}

export function registerRoutes(app: Express): Server {
  // Previous security headers
  app.use((_, res, next) => {
    res.header('Content-Type', 'application/json; charset=utf-8');
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Frame-Options', 'DENY');
    res.header('X-XSS-Protection', '1; mode=block');
    next();
  });

  // Existing routes
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
        model: "gpt-4o",
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

  // New route for PDF processing
  app.post("/api/extract-pdf-passport", upload.single("pdf"), async (req, res) => {
    try {
      if (!req.file || req.file.mimetype !== 'application/pdf') {
        return res.status(400).json({ error: "Valid PDF file required" });
      }

      const extractedData = await processPdfPassport(req.file.buffer);

      // Generate CSV
      const csvWriter = createObjectCsvWriter({
        path: './exports/passport_data.csv',
        header: [
          {id: 'documentNumber', title: 'Document Number'},
          {id: 'surname', title: 'Surname'},
          {id: 'givenNames', title: 'Given Names'},
          {id: 'dateOfBirth', title: 'Date of Birth'},
          {id: 'dateOfExpiry', title: 'Date of Expiry'},
          {id: 'nationality', title: 'Nationality'},
          {id: 'sex', title: 'Sex'}
        ]
      });

      await csvWriter.writeRecords(extractedData);

      res.json({
        success: true,
        count: extractedData.length,
        data: extractedData,
        csvPath: '/exports/passport_data.csv'
      });

    } catch (error: any) {
      console.error('PDF extraction error:', error);
      res.status(500).json({ 
        error: "PDF processing failed",
        details: error.message.slice(0, 100)
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}