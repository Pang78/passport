import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { extractPassportData } from "../client/src/lib/openai";
import sharp from "sharp";
import { fromPath } from "pdf2pic";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

const upload = multer({
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for PDFs
  },
});

export function registerRoutes(app: Express): Server {
  app.post("/api/extract-passport", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).send("No file uploaded");
      }

      let base64Image: string;

      if (req.file.mimetype === "application/pdf") {
        try {
          const pdfImgConvert = require('pdf-img-convert');
          
          // Convert PDF to images
          const outputImages = await pdfImgConvert.convert(req.file.buffer, {
            width: 2000,
            height: 2000,
            page_numbers: [0],
            base64: true
          });
          
          if (!outputImages?.[0]) {
            throw new Error("Failed to convert PDF to image");
          }

          base64Image = outputImages[0];

        } catch (error: any) {
          return res.status(400).send("Failed to process PDF: " + error.message);
        }
      } else if (req.file.mimetype.startsWith("image/")) {
        // For images, use sharp to normalize format and quality
        const processedImage = await sharp(req.file.buffer)
          .jpeg({ quality: 90 })
          .toBuffer();
        base64Image = processedImage.toString("base64");
      } else {
        return res.status(400).send("File must be a PDF or image");
      }

      const passportData = await extractPassportData(base64Image);
      res.json(passportData);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}