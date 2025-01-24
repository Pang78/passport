import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { extractPassportData } from "../client/src/lib/openai";

const upload = multer({
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

export function registerRoutes(app: Express): Server {
  app.post("/api/extract-passport", upload.single("image"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).send("No image file uploaded");
      }

      if (!req.file.mimetype.startsWith("image/")) {
        return res.status(400).send("Uploaded file must be an image");
      }

      const base64Image = req.file.buffer.toString("base64");
      const passportData = await extractPassportData(base64Image);
      
      res.json(passportData);
    } catch (error: any) {
      res.status(500).send(error.message);
    }

  app.post("/api/check-quality", upload.single("image"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).send("No image file uploaded");
      }

      const base64Image = req.file.buffer.toString("base64");
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert at analyzing passport photo quality. Evaluate if the image is clear enough for passport data extraction."
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Is this image clear enough to extract passport data? Respond with JSON only containing isValid (boolean) and message (string)."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ],
          }
        ],
        max_tokens: 150,
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error("No content received from OpenAI");
      }

      const result = JSON.parse(content.replace(/```json\s*|\s*```/g, ''));
      res.json(result);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  });

  const httpServer = createServer(app);
  return httpServer;
}
