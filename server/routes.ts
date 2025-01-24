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
          // Save PDF to temp file
          const tempPath = path.join(os.tmpdir(), `${Date.now()}.pdf`);
          await fs.writeFile(tempPath, req.file.buffer);

          // Convert PDF to image
          const options = {
            density: 300,
            saveFilename: "passport",
            savePath: os.tmpdir(),
            format: "jpeg",
            width: 2000,
            height: 2000
          };

          const convert = fromPath(tempPath, options);
          const pageOutput = await convert(1); // Convert first page

          if (!pageOutput.base64) {
            throw new Error("Failed to convert PDF to image");
          }

          base64Image = pageOutput.base64;

          // Clean up temp files
          await fs.unlink(tempPath);
          await fs.unlink(path.join(os.tmpdir(), 'passport.1.jpeg'));

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