import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { extractPassportData } from "../client/src/lib/openai";
const { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } = require('@zxing/library');


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
      const scanQr = true; // Assuming we always want to scan for QR codes and barcodes

      if (scanQr) {
        const { createCanvas, loadImage } = require("canvas");
        const jsQR = require("jsqr");

        const img = await loadImage(`data:image/jpeg;base64,${base64Image}`);
        const canvas = createCanvas(img.width, img.height);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, img.width, img.height);

        // Try QR code first
        const qrCode = jsQR(imageData.data, imageData.width, imageData.height);
        if (qrCode) {
          return res.json({ type: 'QR', data: qrCode.data });
        }

        // Try barcode
        try {
          const hints = new Map();
          const formats = [
            BarcodeFormat.EAN_8,
            BarcodeFormat.EAN_13,
            BarcodeFormat.UPC_A,
            BarcodeFormat.UPC_E,
            BarcodeFormat.CODE_128,
            BarcodeFormat.CODE_39,
            BarcodeFormat.CODE_93,
            BarcodeFormat.ITF
          ];
          hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);

          const reader = new BrowserMultiFormatReader(hints);
          const result = reader.decode(imageData);

          if (result) {
            return res.json({ type: 'Barcode', data: result.getText() });
          }
        } catch (error) {
          console.log('No barcode found');
        }
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