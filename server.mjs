import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

process.on('SIGHUP', () => {});

const PORT = 8089;
const DIST_DIR = '/home/antigravity/neowarfare-fps/dist';
const INDEX_FILE = path.join(DIST_DIR, 'index.html');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};

const server = http.createServer((req, res) => {
  const urlPath = (req.url || '/').split('?')[0];
  let filePath = path.join(DIST_DIR, urlPath === '/' ? 'index.html' : urlPath);
  if (!filePath.startsWith(DIST_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = INDEX_FILE;
  }
  const ext = path.extname(filePath);
  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': data.length,
      'Cache-Control': 'no-cache',
    });
    if (req.method === 'HEAD') res.end();
    else res.end(data);
  } catch (err) {
    res.writeHead(500);
    res.end('Internal server error');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`VANGUARD 2089 server listening on http://0.0.0.0:${PORT}`);
});
