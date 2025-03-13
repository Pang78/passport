// vercel.js - Adapter for Vercel serverless functions
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Initialize application
const app = express();
app.use(express.json());

// Set up paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, 'public');

// Basic health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// All other routes - serve the index.html
app.get('*', (req, res) => {
  const indexPath = path.join(publicDir, 'index.html');
  
  // Check if the file exists (it might not during build)
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    // Fallback if file doesn't exist
    res.send(`
      <html>
        <head>
          <title>Passport Analyzer API</title>
          <style>
            body { font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
            h1 { color: #0070f3; }
          </style>
        </head>
        <body>
          <h1>Passport Analyzer API</h1>
          <p>This is an API-only deployment.</p>
          <p>Available endpoints:</p>
          <ul>
            <li><code>GET /api/health</code> - Health check</li>
            <li><code>POST /api/extract-passport</code> - Extract passport data</li>
          </ul>
        </body>
      </html>
    `);
  }
});

export default app; 