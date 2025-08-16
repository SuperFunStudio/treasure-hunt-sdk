// simple-dev-server.js - Basic HTTP server for test-UI.html
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const server = http.createServer((req, res) => {
  // Handle root path - serve test-UI.html
  if (req.url === '/' || req.url === '/test-UI.html') {
    const filePath = path.join(__dirname, 'test-UI.html');
    
    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404);
        res.end('test-UI.html not found');
        return;
      }
      
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content);
    });
  }
  // Handle other static files if needed
  else if (req.url.endsWith('.js') || req.url.endsWith('.css')) {
    const filePath = path.join(__dirname, req.url);
    
    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404);
        res.end('File not found');
        return;
      }
      
      const contentType = req.url.endsWith('.js') ? 'application/javascript' : 'text/css';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  }
  else {
    res.writeHead(404);
    res.end('Not found');
  }
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`🚀 Development server running at http://localhost:${PORT}`);
  console.log(`📱 Open http://localhost:${PORT} to test your UI`);
  console.log(`🔗 Your Firebase functions are live at:`);
  console.log(`   - https://app-beprv7ll2q-uc.a.run.app`);
  console.log(`   - https://testebayendpoint-beprv7ll2q-uc.a.run.app`);
  console.log(`   - https://health-beprv7ll2q-uc.a.run.app`);
  console.log(`   - https://ebaynotifications-beprv7ll2q-uc.a.run.app`);
});