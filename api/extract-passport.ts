import { VercelRequest, VercelResponse } from '@vercel/node';
import multer from 'multer';
import sharp from 'sharp';
import crypto from 'crypto';
import { extractPassportData } from '../client/src/lib/openai';

// Configure multer for in-memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1
  },
  fileFilter: (_, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
    }
  }
});

// Cache for processed images
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

// Vercel doesn't support middleware directly, so we need a wrapper function
const runMiddleware = (req: VercelRequest, res: VercelResponse, fn: Function) => {
  return new Promise((resolve, reject) => {
    fn(req, res, (result: any) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Use multer to process the uploaded file
    await runMiddleware(req, res, upload.single('image'));
    
    // @ts-ignore - Vercel types don't include file property added by multer
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

    const passportData = await extractPassportData(processed.toString('base64'));

    return res.status(200).json({
      ...passportData,
      imageUrl: `data:image/jpeg;base64,${processed.toString('base64')}`,
      metadata: {
        dimensions: { 
          width: metadata.width ?? 0, 
          height: metadata.height ?? 0
        },
        format: metadata.format,
        size: processed.length
      },
      thumbnail: `data:image/jpeg;base64,${thumbnail.toString('base64')}`
    });
  } catch (error: any) {
    console.error('Passport extraction error:', error);
    return res.status(500).json({ 
      error: 'Processing failed',
      details: error.message.slice(0, 100)
    });
  }
} 