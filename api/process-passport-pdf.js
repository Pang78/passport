// api/process-passport-pdf.js - Endpoint for processing PDF files with passport images
import multer from 'multer';
import { extractPassportData } from './openai.js';
import { OpenAI } from 'openai';
import crypto from 'crypto';
import pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';
import sharp from 'sharp';
import { createObjectCsvWriter } from 'csv-writer';
import path from 'path';
import fs from 'fs';
import os from 'os';

// Set up PDF.js
const PDFJS_WORKER_URL = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/legacy/build/pdf.worker.min.js`;
pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;

// Set up OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Configure multer for in-memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 1
  },
  fileFilter: (_, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
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

// Helper for converting PDF page to image
async function convertPdfPageToImage(pdfDoc, pageNumber, dpi = 200) {
  try {
    const page = await pdfDoc.getPage(pageNumber);
    
    // Calculate viewport dimensions for the desired DPI
    const viewport = page.getViewport({ scale: dpi / 72 }); // 72 DPI is the PDF standard
    
    // Create a canvas to render the page
    const canvasFactory = {
      create: function (width, height) {
        const canvas = { width, height };
        canvas.getContext = function () {
          return {
            // This is a dummy context that saves the image data
            drawImage: () => {},
            putImageData: () => {},
            setTransform: () => {},
            transform: () => {},
            scale: () => {},
            save: () => {},
            fillStyle: '',
            strokeStyle: '',
            lineWidth: 0,
            font: '',
            globalAlpha: 1,
            globalCompositeOperation: 'source-over',
            shadowBlur: 0,
            shadowColor: '',
            shadowOffsetX: 0,
            shadowOffsetY: 0,
            lineCap: 'butt',
            lineJoin: 'miter',
            miterLimit: 10,
            lineDashOffset: 0,
            direction: 'ltr',
            textAlign: 'start',
            textBaseline: 'alphabetic',
            filter: 'none',
            restore: () => {},
            rotate: () => {},
            translate: () => {},
            createLinearGradient: () => {},
            createRadialGradient: () => {},
            createPattern: () => {},
            beginPath: () => {},
            closePath: () => {},
            moveTo: () => {},
            lineTo: () => {},
            bezierCurveTo: () => {},
            quadraticCurveTo: () => {},
            arc: () => {},
            arcTo: () => {},
            ellipse: () => {},
            rect: () => {},
            clearRect: () => {},
            fillRect: () => {},
            strokeRect: () => {},
            fill: () => {},
            stroke: () => {},
            clip: () => {},
            isPointInPath: () => false,
            isPointInStroke: () => false,
            measureText: () => ({ width: 0 }),
            createImageData: () => ({ data: new Uint8ClampedArray(0), width: 0, height: 0 }),
            getImageData: () => ({ data: new Uint8ClampedArray(0), width: 0, height: 0 }),
            fillText: () => {},
            strokeText: () => {},
            drawFocusIfNeeded: () => {},
            scrollPathIntoView: () => {},
            getLineDash: () => [],
            setLineDash: () => {},
            drawImage: () => {},
            canvas: { width, height },
          };
        };
        return canvas;
      },
      reset: function (canvas, width, height) {
        canvas.width = width;
        canvas.height = height;
      },
    };

    // Create a rendering context for the page
    const renderContext = {
      canvasContext: canvasFactory.create(viewport.width, viewport.height).getContext('2d'),
      viewport: viewport,
      canvasFactory: canvasFactory,
    };

    // Render the page to SVG (more reliable for text extraction)
    const opList = await page.getOperatorList();
    const svgGfx = new pdfjsLib.SVGGraphics(
      page.commonObjs,
      page.objs
    );
    svgGfx.embedFonts = true;
    const svg = await svgGfx.getSVG(opList, viewport);
    const svgString = new XMLSerializer().serializeToString(svg);
    
    // Convert SVG to image using sharp
    const buffer = Buffer.from(svgString);
    const image = await sharp(buffer, { density: dpi })
      .resize(1200, 1200, { fit: 'inside' })
      .jpeg({ quality: 80 })
      .toBuffer();
      
    return image;
  } catch (error) {
    console.error(`Error converting PDF page ${pageNumber} to image:`, error);
    throw error;
  }
}

// Helper function to extract text content from a PDF page
async function extractTextFromPdfPage(pdfDoc, pageNumber) {
  try {
    const page = await pdfDoc.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const strings = textContent.items.map(item => 'str' in item ? item.str : '');
    return strings.join(' ');
  } catch (error) {
    console.error(`Error extracting text from PDF page ${pageNumber}:`, error);
    return '';
  }
}

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Use multer to process the uploaded PDF file
    await runMiddleware(req, res, upload.single('pdf'));
    
    // @ts-ignore - Vercel types don't include file property added by multer
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ error: 'No PDF file provided' });
    }

    // Track progress
    console.log(`Processing PDF file: ${file.originalname}`);
    const batchId = crypto.randomBytes(8).toString('hex');
    const startTime = Date.now();
    
    // Load the PDF document
    const buffer = file.buffer;
    const data = new Uint8Array(buffer);
    
    const loadingTask = pdfjsLib.getDocument({
      data: data,
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
      cMapPacked: true,
      useSystemFonts: true,
      standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/standard_fonts/'
    });
    
    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;
    
    console.log(`PDF document loaded with ${numPages} pages`);
    
    // Process each page
    const results = [];
    const errors = [];
    
    // Use chunking for controlled concurrency
    const MAX_CONCURRENT = 3;
    const chunks = [];
    
    // Create arrays of page numbers divided into chunks
    for (let i = 1; i <= numPages; i += MAX_CONCURRENT) {
      chunks.push(Array.from(
        { length: Math.min(MAX_CONCURRENT, numPages - i + 1) },
        (_, index) => i + index
      ));
    }
    
    // Process chunks sequentially, but pages within a chunk in parallel
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`Processing chunk ${i+1}/${chunks.length} (pages ${chunk[0]}-${chunk[chunk.length-1]})`);
      
      const chunkResults = await Promise.all(chunk.map(async (pageNumber) => {
        try {
          console.log(`Processing page ${pageNumber}/${numPages}`);
          
          // First try extracting text
          const text = await extractTextFromPdfPage(pdfDoc, pageNumber);
          
          // Convert the page to an image
          const image = await convertPdfPageToImage(pdfDoc, pageNumber);
          
          // Generate a thumbnail
          const thumbnail = await sharp(image)
            .resize(300, 300, { fit: 'inside' })
            .jpeg({ quality: 60 })
            .toBuffer();
          
          // Extract data using OpenAI
          const base64Image = image.toString('base64');
          const result = await extractPassportData(base64Image, openai);
          
          return {
            pageNumber,
            data: result.extractedData,
            extractedText: text,
            rawAnalysis: result.rawText,
            thumbnail: `data:image/jpeg;base64,${thumbnail.toString('base64')}`,
            confidenceScore: result.overall_confidence
          };
        } catch (error) {
          console.error(`Error processing page ${pageNumber}:`, error);
          errors.push({
            pageNumber,
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
    
    console.log(`PDF processing complete. Processed ${successCount} pages successfully with ${errorCount} errors in ${processingTime} seconds`);

    // Generate CSV if requested
    let csvPath = null;
    if (req.query.format === 'csv') {
      try {
        // Create a temp file
        const tempDir = os.tmpdir();
        csvPath = path.join(tempDir, `passport_data_${batchId}.csv`);
        
        // Set up CSV writer
        const csvWriter = createObjectCsvWriter({
          path: csvPath,
          header: [
            { id: 'pageNumber', title: 'Page Number' },
            { id: 'fullName', title: 'Full Name' },
            { id: 'passportNumber', title: 'Passport Number' },
            { id: 'dateOfBirth', title: 'Date of Birth' },
            { id: 'dateOfIssue', title: 'Date of Issue' },
            { id: 'dateOfExpiry', title: 'Date of Expiry' },
            { id: 'nationality', title: 'Nationality' },
            { id: 'placeOfBirth', title: 'Place of Birth' },
            { id: 'issuingAuthority', title: 'Issuing Authority' },
            { id: 'gender', title: 'Gender' },
            { id: 'confidenceScore', title: 'Confidence Score' }
          ]
        });
        
        // Convert results to CSV format
        const csvRecords = results.map(result => {
          const data = result.data;
          return {
            pageNumber: result.pageNumber,
            fullName: data.fullName,
            passportNumber: data.passportNumber,
            dateOfBirth: data.dateOfBirth,
            dateOfIssue: data.dateOfIssue,
            dateOfExpiry: data.dateOfExpiry,
            nationality: data.nationality,
            placeOfBirth: data.placeOfBirth,
            issuingAuthority: data.issuingAuthority,
            gender: data.gender,
            confidenceScore: result.confidenceScore
          };
        });
        
        // Write records to CSV
        await csvWriter.writeRecords(csvRecords);
        
        // Read the CSV file
        const csvContent = fs.readFileSync(csvPath, 'utf8');
        
        // Clean up the temp file
        fs.unlinkSync(csvPath);
        
        // Return CSV content directly
        return res.status(200)
          .setHeader('Content-Type', 'text/csv')
          .setHeader('Content-Disposition', `attachment; filename="passport_data_${batchId}.csv"`)
          .send(csvContent);
      } catch (csvError) {
        console.error('Error generating CSV:', csvError);
        // Fall back to JSON response if CSV generation fails
      }
    }

    // Return JSON results
    return res.status(200).json({
      batchId,
      filename: file.originalname,
      summary: {
        totalPages: numPages,
        successfullyProcessed: successCount,
        errors: errorCount,
        processingTimeSeconds: processingTime
      },
      results,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('PDF processing error:', error);
    return res.status(500).json({ 
      error: 'PDF processing failed',
      details: error.message
    });
  }
} 