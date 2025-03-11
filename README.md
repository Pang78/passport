# Passport Analyzer

A web application for extracting and analyzing passport data using AI.

## Features

- Upload passport images for data extraction
- Capture images directly from camera for analysis
- PDF passport data extraction
- Quality checking of passport images
- Data validation and verification

## Tech Stack

- **Frontend**: React, TypeScript, TailwindCSS
- **Backend**: Vercel Serverless Functions
- **Image Processing**: Sharp
- **PDF Processing**: PDF.js
- **AI**: OpenAI GPT-4o

## Deployment to Vercel

### Prerequisites

- Node.js 18+
- Vercel CLI (`npm i -g vercel`)
- OpenAI API key

### Environment Variables

Create a `.env.local` file with the following variables:

```
OPENAI_API_KEY=your_openai_api_key
```

### Local Development

1. Install dependencies:

   ```
   npm install
   ```

2. Start the development server:

   ```
   npm run dev
   ```

3. Open [http://localhost:5000](http://localhost:5000) in your browser.

### Deploying to Vercel

1. Login to Vercel:

   ```
   vercel login
   ```

2. Deploy the project:

   ```
   vercel
   ```

3. Add your environment variables in the Vercel dashboard:

   - Go to your project in the Vercel dashboard
   - Navigate to Settings > Environment Variables
   - Add the required environment variables

4. For production deployment:
   ```
   vercel --prod
   ```

## API Routes

- `POST /api/extract-passport` - Extract data from passport images
- `POST /api/check-quality` - Check the quality of passport images
- `POST /api/extract-pdf-passport` - Extract data from PDF passports

## Notes

- The application uses client-side code for the UI and Vercel serverless functions for the API.
- All processing is done in memory and no data is persistently stored.
- The maximum file size for uploads is 10MB.
