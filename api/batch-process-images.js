// api/batch-process-images.js - Endpoint for batch processing multiple passport images
import multer from 'multer';
import sharp from 'sharp';
import { extractPassportData } from './openai.js';
import { OpenAI } from 'openai';
import path from 'path';
import crypto from 'crypto';

// Set up OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Configure multer for in-memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
    files: 50 // Allow up to 50 files per request
  }
});

// Helper for running multer middleware in serverless environment
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

// Helper for image processing
async function processImage(buffer) {
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
    // Use multer to process the uploaded files
    await runMiddleware(req, res, upload.array('images'));
    
    // @ts-ignore - Vercel types don't include files property added by multer
    const files = req.files;
    
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No images provided' });
    }

    // Track overall progress
    console.log(`Starting batch processing of ${files.length} images`);
    const batchId = crypto.randomBytes(8).toString('hex');
    const startTime = Date.now();
    
    // Process each file
    const results = [];
    const errors = [];

    // Instead of sequential processing, we'll use Promise.all for parallel processing
    // but with a max concurrency to avoid overwhelming the system
    const MAX_CONCURRENT = 5;
    const chunks = [];
    
    // Split files into chunks for controlled concurrency
    for (let i = 0; i < files.length; i += MAX_CONCURRENT) {
      chunks.push(files.slice(i, i + MAX_CONCURRENT));
    }
    
    // Process chunks sequentially, but files within a chunk in parallel
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkResults = await Promise.all(chunk.map(async (file, index) => {
        const fileIndex = i * MAX_CONCURRENT + index;
        try {
          console.log(`Processing file ${fileIndex + 1}/${files.length}: ${file.originalname}`);
          
          // Process the image
          const { processed, metadata } = await processImage(file.buffer);
          
          // Skip if image is too large after processing
          if (processed.length > 2 * 1024 * 1024) {
            throw new Error('Image too large after processing');
          }
          
          // Extract data using OpenAI
          const base64Image = processed.toString('base64');
          const result = await extractPassportData(base64Image, openai);
          
          // Generate thumbnail
          const thumbnail = await sharp(processed)
            .resize(300, 300, { fit: 'inside' })
            .jpeg({ quality: 60 })
            .toBuffer();
          
          return {
            filename: file.originalname,
            index: fileIndex,
            data: result.extractedData,
            metadata: {
              dimensions: { 
                width: metadata.width || 0, 
                height: metadata.height || 0
              },
              format: metadata.format,
              size: processed.length
            },
            thumbnail: `data:image/jpeg;base64,${thumbnail.toString('base64')}`,
            confidenceScore: result.overall_confidence
          };
        } catch (error) {
          console.error(`Error processing file ${fileIndex + 1}:`, error);
          errors.push({
            filename: file.originalname,
            index: fileIndex,
            error: error.message || 'Unknown error'
          });
          return null;
        }
      }));
      
      // Add successful results to the results array
      results.push(...chunkResults.filter(Boolean));
    }

    // Calculate processing statistics
    const endTime = Date.now();
    const processingTime = (endTime - startTime) / 1000; // in seconds
    const successCount = results.length;
    const errorCount = errors.length;
    
    console.log(`Batch processing complete. Processed ${successCount} images successfully with ${errorCount} errors in ${processingTime} seconds`);

    // Return results
    return res.status(200).json({
      batchId,
      summary: {
        totalFiles: files.length,
        successfullyProcessed: successCount,
        errors: errorCount,
        processingTimeSeconds: processingTime
      },
      results,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Batch processing error:', error);
    return res.status(500).json({ 
      error: 'Batch processing failed',
      details: error.message
    });
  }
} 