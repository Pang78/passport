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
- **Backend**: Express.js, Node.js
- **Image Processing**: Sharp
- **PDF Processing**: PDF.js
- **AI**: OpenAI GPT-4o

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- OpenAI API key

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/Pang78/passport.git
   cd passport
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   Then edit the `.env` file and add your OpenAI API key.

### Local Development

1. Start the development server:

   ```bash
   npm run dev
   ```

2. Open [http://localhost:5000](http://localhost:5000) in your browser.

### Building for Production

1. Build the application:

   ```bash
   npm run build
   ```

2. Start the production server:
   ```bash
   npm start
   ```

## Deployment Options

### Deploying to Vercel

1. Install Vercel CLI:

   ```bash
   npm i -g vercel
   ```

2. Login to Vercel:

   ```bash
   vercel login
   ```

3. Deploy the project:

   ```bash
   vercel
   ```

4. Add your environment variables in the Vercel dashboard:

   - Go to your project in the Vercel dashboard
   - Navigate to Settings > Environment Variables
   - Add the required environment variables

5. For production deployment:
   ```bash
   vercel --prod
   ```

### Deploying to GitHub Pages or Other Platforms

This application requires a backend server for API calls. For static hosting platforms like GitHub Pages, you would need to:

1. Separate the frontend and backend
2. Deploy the backend to a server that can run Node.js (e.g., Heroku, Railway, Render)
3. Update API endpoints in the frontend to point to your deployed backend

## API Routes

- `POST /api/extract-passport` - Extract data from passport images
- `POST /api/check-quality` - Check the quality of passport images
- `POST /api/extract-pdf-passport` - Extract data from PDF passports

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Notes

- The application uses Express.js for the backend and React for the frontend.
- All processing is done in memory and no data is persistently stored.
- The maximum file size for uploads is 10MB.
