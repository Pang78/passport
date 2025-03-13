// api/health.js - Simple health check endpoint
export default function handler(req, res) {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'unknown',
    version: process.env.npm_package_version || '1.0.0'
  });
} 