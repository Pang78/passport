import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure server directory exists in dist
const serverDistDir = path.join(__dirname, 'dist', 'server');
if (!fs.existsSync(serverDistDir)) {
  fs.mkdirSync(serverDistDir, { recursive: true });
}

// Copy necessary files if they don't exist in the right place
const sourceServerDir = path.join(__dirname, 'server');
const sourceFiles = fs.readdirSync(sourceServerDir);

// Check if server files were compiled correctly
const indexJsPath = path.join(serverDistDir, 'index.js');
const routesJsPath = path.join(serverDistDir, 'routes.js');

if (!fs.existsSync(indexJsPath) || !fs.existsSync(routesJsPath)) {
  // Files weren't compiled correctly to the server directory
  console.log('Server files not found in expected location, copying from dist root...');
  
  // Copy files from dist root to server directory if they exist there
  const distIndexPath = path.join(__dirname, 'dist', 'index.js');
  const distRoutesPath = path.join(__dirname, 'dist', 'routes.js');
  
  if (fs.existsSync(distIndexPath)) {
    fs.copyFileSync(distIndexPath, indexJsPath);
    console.log('Copied index.js to server directory');
  }
  
  if (fs.existsSync(distRoutesPath)) {
    fs.copyFileSync(distRoutesPath, routesJsPath);
    console.log('Copied routes.js to server directory');
  }
}

// Check for server directory structure
const serverFiles = fs.readdirSync(serverDistDir, { withFileTypes: true });
console.log('Server directory contents:', serverFiles.map(f => f.name));

// Create simple placeholder files if they don't exist
if (!fs.existsSync(indexJsPath)) {
  console.log('Creating placeholder index.js');
  fs.writeFileSync(indexJsPath, `
    import express from 'express';
    import fs from 'fs';
    import path from 'path';
    import { fileURLToPath } from 'url';
    
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    
    // Check if routes.js exists
    const routesPath = path.join(__dirname, 'routes.js');
    let registerRoutes;
    
    if (fs.existsSync(routesPath)) {
      const routesModule = await import('./routes.js');
      registerRoutes = routesModule.registerRoutes;
    } else {
      console.error('routes.js not found!');
      registerRoutes = (app) => {
        app.get('/api', (req, res) => {
          res.json({ message: 'API running, but routes.js not found' });
        });
        return app;
      };
    }
    
    const app = express();
    app.use(express.json());
    
    registerRoutes(app);
    
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      console.log(\`Server running on port \${port}\`);
    });
  `);
}

if (!fs.existsSync(routesJsPath)) {
  console.log('Creating placeholder routes.js');
  fs.writeFileSync(routesJsPath, `
    import { createServer } from 'http';
    
    export function registerRoutes(app) {
      app.get('/api', (req, res) => {
        res.json({ message: 'API running with placeholder routes.js' });
      });
      
      return createServer(app);
    }
  `);
}

console.log('Build post-processing complete!'); 