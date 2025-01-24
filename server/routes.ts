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
  });

  const httpServer = createServer(app);
  return httpServer;
}
