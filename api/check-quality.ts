import { VercelRequest, VercelResponse } from '@vercel/node';
import multer from 'multer';
import sharp from 'sharp';
import { OpenAI } from 'openai';

// Configure OpenAI
const openai = new OpenAI();

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

    const preview = await sharp(file.buffer)
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

    return res.status(200).json(JSON.parse(content));
  } catch (error: any) {
    console.error('Quality check error:', error);
    return res.status(error.status || 500).json({
      error: "Quality check failed",
      details: error.message.includes("rate limit") 
        ? "Service is temporarily busy, please try again in a few moments"
        : "Internal processing error"
    });
  }
} 