// api/index.js - Serverless entry point for Vercel
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import multer from 'multer';
import sharp from 'sharp';
import { OpenAI } from 'openai';
import { extractPassportData } from './openai.js';

// Initialize environment
const envFile = process.env.NODE_ENV === 'development' ? '.env.development' : '.env';
console.log(`Loading environment from ${envFile}`);
dotenv.config({ path: envFile });

// Set up OpenAI
let openai;
try {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('⚠️ WARNING: OPENAI_API_KEY environment variable is missing.');
  }
  openai = new OpenAI({
    apiKey: apiKey || 'dummy-key-for-development'
  });
} catch (error) {
  console.error('Error initializing OpenAI:', error);
}

// Helpers for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Image processing utility function
async function safeProcessImage(buffer) {
  try {
    // Process image using sharp
    const processed = await sharp(buffer)
      .resize(1200, 1200, { fit: 'inside' })
      .jpeg({ quality: 80 })
      .toBuffer();

    // Get metadata
    const metadata = await sharp(buffer).metadata();
    
    return { processed, metadata };
  } catch (error) {
    console.error('Error processing image:', error);
    throw new Error('Image processing failed');
  }
}

// Create Express app
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }
      console.log(logLine);
    }
  });

  next();
});

// Security and CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Primary route for passport extraction
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

    // Base64 encode the image
    const base64Image = processed.toString('base64');

    // If no OpenAI key, return placeholder data in development
    if (!process.env.OPENAI_API_KEY && process.env.NODE_ENV === 'development') {
      return res.json({
        thumbnail: thumbnail.toString('base64'),
        data: {
          "passport_number": "SAMPLE12345",
          "surname": "DOE",
          "given_names": "JOHN EXAMPLE",
          "nationality": "UNITED STATES OF AMERICA",
          "date_of_birth": "01 JAN 1980",
          "place_of_birth": "NEW YORK, USA",
          "date_of_issue": "01 JAN 2020",
          "date_of_expiry": "01 JAN 2030",
          "authority": "DEPARTMENT OF STATE",
          "sex": "M",
          "type": "P"
        },
        rawText: "Sample passport data for development"
      });
    }

    // Extract data using OpenAI
    const result = await extractPassportData(base64Image, openai);
    
    return res.json({
      thumbnail: thumbnail.toString('base64'),
      data: result.extractedData,
      rawText: result.rawText
    });
  } catch (error) {
    console.error("Error processing passport:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// Basic health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Fallback route for static files or client-side routing
app.use("*", (req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

// Export for serverless use
export default app; 