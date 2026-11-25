import http from 'http';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

const port = 3098;
const scratchDir = 'C:/Users/USER/.gemini/antigravity/brain/34377b69-a3e2-4b53-b100-92ebc5906a52/scratch';
const pdfPath = 'C:/Users/USER/.gemini/antigravity/brain/34377b69-a3e2-4b53-b100-92ebc5906a52/.user_uploaded/media_1795427579927_5af69bba.pdf';

let savedCount = 0;

const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/render_pdf.html') {
    const content = fs.readFileSync(path.join(scratchDir, 'render_pdf.html'));
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(content);
    return;
  }

  if (req.url === '/media_1795427579927_5af69bba.pdf') {
    const content = fs.readFileSync(pdfPath);
    res.writeHead(200, { 'Content-Type': 'application/pdf' });
    res.end(content);
    return;
  }

  if (req.url === '/save-page' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { page, dataUrl } = JSON.parse(body);
        const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
        const buf = Buffer.from(base64Data, 'base64');
        const outPath = path.join(scratchDir, `rendered_page_${page}.jpg`);
        fs.writeFileSync(outPath, buf);
        console.log(`Saved rendered page ${page} (${buf.length} bytes) to ${outPath}`);
        savedCount++;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));

        if (savedCount >= 7) {
          console.log('ALL 7 PAGES RENDERED SUCCESSFULLY!');
          setTimeout(() => {
            process.exit(0);
          }, 1000);
        }
      } catch (e) {
        console.error('Error saving page:', e);
        res.writeHead(500);
        res.end(e.message);
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(port, () => {
  console.log(`Server listening on port ${port}... Launching Chrome...`);
  const chromeCmd = `"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --headless --disable-gpu http://localhost:${port}/render_pdf.html`;
  exec(chromeCmd, (err, stdout, stderr) => {
    if (err) console.error('Chrome execution error:', err);
  });
});
