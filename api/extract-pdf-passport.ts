import { VercelRequest, VercelResponse } from '@vercel/node';
import multer from 'multer';
import { createObjectCsvWriter } from 'csv-writer';
import path from 'path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { TextContent } from 'pdfjs-dist/types/src/display/api';
import { OpenAI } from 'openai';
import os from 'os';
import { writeFile } from 'fs/promises';

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
    const allowedTypes = ['application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
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

// Configure PDF.js with proper worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;

async function processPdfPassport(buffer: Buffer): Promise<Array<any>> {
  const extractedData = [];

  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
      standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/standard_fonts/',
    });

    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;

    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text = (content as TextContent).items
        .map(item => 'str' in item ? item.str : '')
        .join(' ');

      // Use OpenAI to extract passport data from the text
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `Extract passport data from this text. Return valid JSON with these fields if found:
            {
              "documentNumber": "string",
              "surname": "string",
              "givenNames": "string",
              "dateOfBirth": "YYYY-MM-DD",
              "dateOfExpiry": "YYYY-MM-DD",
              "nationality": "string",
              "sex": "string"
            }
            If you can't identify a field, set its value to null.`
          },
          {
            role: "user",
            content: text
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 500,
      });

      const content_text = response.choices[0].message.content;
      if (content_text) {
        try {
          const parsedData = JSON.parse(content_text);
          extractedData.push(parsedData);
        } catch (error) {
          console.error("Error parsing JSON from AI response:", error);
        }
      }
    }

    return extractedData;
  } catch (error) {
    console.error("PDF processing error:", error);
    throw error;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Use multer to process the uploaded file
    await runMiddleware(req, res, upload.single('pdf'));
    
    // @ts-ignore - Vercel types don't include file property added by multer
    const file = req.file;
    
    if (!file || file.mimetype !== 'application/pdf') {
      return res.status(400).json({ error: 'Valid PDF file required' });
    }

    const extractedData = await processPdfPassport(file.buffer);

    // For Vercel, we need to use a temporary file since we don't have access to the filesystem
    const tempDir = os.tmpdir();
    const csvFilePath = path.join(tempDir, 'passport_data.csv');
    
    // Generate CSV
    const csvWriter = createObjectCsvWriter({
      path: csvFilePath,
      header: [
        {id: 'documentNumber', title: 'Document Number'},
        {id: 'surname', title: 'Surname'},
        {id: 'givenNames', title: 'Given Names'},
        {id: 'dateOfBirth', title: 'Date of Birth'},
        {id: 'dateOfExpiry', title: 'Date of Expiry'},
        {id: 'nationality', title: 'Nationality'},
        {id: 'sex', title: 'Sex'}
      ]
    });

    await csvWriter.writeRecords(extractedData);
    
    // Read the CSV content to return to client
    const csvContent = await writeFile(csvFilePath, JSON.stringify(extractedData));

    return res.status(200).json({
      success: true,
      count: extractedData.length,
      data: extractedData,
      // Note: In Vercel, we can't save files persistently, so just return the data
      csvData: JSON.stringify(extractedData)
    });
  } catch (error: any) {
    console.error('PDF extraction error:', error);
    return res.status(500).json({ 
      error: "PDF processing failed",
      details: error.message.slice(0, 100)
    });
  }
} 