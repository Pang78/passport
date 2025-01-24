import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const upload = multer({
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

async function analyzeDocument(imageBuffer: Buffer) {
  const base64Image = imageBuffer.toString('base64');
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "You are an expert document analyzer. Extract structured information from the document image. Return data in a consistent JSON format with 'documentType', 'fields' as key-value pairs of extracted data, and 'confidence' as a number between 0 and 1."
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Analyze this document and extract all visible information. Format as JSON with fields for each data point."
          },
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${base64Image}`
            }
          }
        ],
      },
    ],
    response_format: { type: "json_object" }
  });

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error('No response content from OpenAI');
  }

  const result = JSON.parse(content);
  return {
    type: result.documentType || 'unknown',
    fields: result.fields || {},
    confidence: result.confidence || 0
  };
}

export function registerRoutes(app: Express): Server {
  app.post("/api/analyze-document", upload.single("image"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No image file uploaded" });
      }

      if (!req.file.mimetype.startsWith("image/")) {
        return res.status(400).json({ message: "Uploaded file must be an image" });
      }

      const result = await analyzeDocument(req.file.buffer);
      res.json(result);
    } catch (error: any) {
      console.error('Error analyzing document:', error);
      res.status(500).json({ message: error.message || "Failed to analyze document" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}