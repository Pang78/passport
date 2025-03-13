// api/extract-passport.js - Serverless function handler for Vercel
import multer from 'multer';
import sharp from 'sharp';
import { extractPassportData } from './openai.js';
import { OpenAI } from 'openai';

// Set up OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Configure multer for in-memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1
  }
});

// Vercel doesn't support middleware directly, so we need a wrapper
const runMiddleware = (req, res, fn) => {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
};

// Image processing utility
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

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Use multer to process the uploaded file
    await runMiddleware(req, res, upload.single('image'));
    
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ error: 'No image provided' });
    }

    const { processed, metadata } = await safeProcessImage(file.buffer);

    if (processed.length > 2 * 1024 * 1024) {
      return res.status(413).json({ error: 'Image too large after processing' });
    }

    // Generate optimized thumbnail
    const thumbnail = await sharp(processed)
      .resize(300, 300, { fit: 'inside' })
      .jpeg({ quality: 60 })
      .toBuffer();

    // Base64 encode the image
    const base64Image = processed.toString('base64');

    // Extract data using OpenAI
    const result = await extractPassportData(base64Image, openai);
    
    return res.status(200).json({
      data: result.extractedData,
      rawText: result.rawText,
      overall_confidence: result.overall_confidence,
      metadata: {
        dimensions: { 
          width: metadata.width || 0, 
          height: metadata.height || 0
        },
        format: metadata.format,
        size: processed.length
      },
      thumbnail: `data:image/jpeg;base64,${thumbnail.toString('base64')}`
    });
  } catch (error) {
    console.error('Passport extraction error:', error);
    return res.status(500).json({ 
      error: 'Processing failed',
      details: error.message
    });
  }
} 