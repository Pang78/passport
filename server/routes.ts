import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { extractPassportData } from "../client/src/lib/openai";
import sharp from "sharp";
import { OpenAI } from "openai";
import crypto from "crypto";
import { createObjectCsvWriter } from "csv-writer";

// Explicitly import the legacy build
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { TextContent } from 'pdfjs-dist/types/src/display/api';

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
  const extractedData = [];

  try {
    const fs = await import('fs/promises');
    await fs.mkdir('./exports', { recursive: true });

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      standardFontDataUrl: './client/public/standard_fonts/',
      cMapUrl: './client/public/standard_fonts/',
      cMapPacked: true,
      disableFontFace: true
    });
    
    const pdfDoc = await loadingTask.promise;
    const pageCount = pdfDoc.numPages;

    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      try {
        const page = await pdfDoc.getPage(pageNum);
        const scale = 1.5;
        const viewport = page.getViewport({ scale });
        
        // Get both text content and operatorList for better extraction
        const [textContent, operatorList] = await Promise.all([
          page.getTextContent(),
          page.getOperatorList()
        ]);

        // Improved text extraction
        const textItems = textContent.items.map((item: any) => ({
          text: item.str,
          x: item.transform[4],
          y: item.transform[5],
          width: item.width,
          height: item.height
        }));

        // Group text by vertical position (within 10 units) to handle multiple columns
        const lineGroups: {[key: string]: any[]} = {};
        textItems.forEach(item => {
          const yKey = Math.round(item.y / 10) * 10;
          if (!lineGroups[yKey]) lineGroups[yKey] = [];
          lineGroups[yKey].push(item);
        });

        // Sort each group by x position and combine
        const pageText = Object.values(lineGroups)
          .map(group => group.sort((a, b) => a.x - b.x).map(item => item.text).join(' '))
          .join('\n');

        // Split into sections more accurately using multiple identifiers
        const passportSections = pageText.split(/(?=(?:\b|^)(?:passport\s+(?:no|number)|nationality|surname|given\s+names?|date\s+of\s+birth)\b)/i);

        for (const section of passportSections) {
          // More thorough section validation
          if (section.trim().length < 50 || 
              !section.match(/(?:passport|nationality|surname|birth)/i)) {
            continue;
          }

          const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
              {
                role: "system",
                content: `Extract passport data as structured JSON. You are processing a PDF section that may contain multiple passports. Requirements:
                - Ensure all dates are in YYYY-MM-DD format
                - Return consistent object structure with all fields
                - Format names in proper case
                - MRZ lines must be 44 characters (or 36 for TD3)

                Required fields:
                {
                  "fullName": "string (surname, given names)",
                  "dateOfBirth": "YYYY-MM-DD",
                  "passportNumber": "string",
                  "nationality": "ISO 3-letter code",
                  "dateOfIssue": "YYYY-MM-DD",
                  "dateOfExpiry": "YYYY-MM-DD",
                  "placeOfBirth": "string",
                  "issuingAuthority": "string",
                  "mrz": {
                    "line1": "string (44 chars)",
                    "line2": "string (44 chars)"
                  }
                }`
              },
              {
                role: "user",
                content: section
              }
            ],
            response_format: { type: "json_object" },
            max_tokens: 1000
          });

          const content = response.choices[0].message.content;
          if (content) {
            extractedData.push(JSON.parse(content));
          }
        }
      } catch (pageError) {
        console.error(`Page ${pageNum} processing failed:`, pageError);
      }
    }
  } catch (error) {
    console.error('PDF processing failed:', error);
    throw new Error('PDF processing error: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }

  return extractedData;
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