import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const binDir = path.resolve(__dirname, '../../bin');
const targetPath = path.join(binDir, 'yt-dlp.exe');

if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
}

console.log('Downloading yt-dlp.exe via Node native fetch...');
const url = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';

try {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
  }

  const contentLength = Number(response.headers.get('content-length') || 0);
  console.log(`Content length: ${(contentLength / 1024 / 1024).toFixed(2)} MB`);

  const fileStream = fs.createWriteStream(targetPath);
  const reader = response.body.getReader();
  let receivedBytes = 0;
  let lastLog = Date.now();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    fileStream.write(Buffer.from(value));
    receivedBytes += value.length;

    if (Date.now() - lastLog > 1000) {
      const pct = contentLength ? ((receivedBytes / contentLength) * 100).toFixed(1) + '%' : `${(receivedBytes / 1024 / 1024).toFixed(2)} MB`;
      console.log(`Progress: ${pct}`);
      lastLog = Date.now();
    }
  }

  fileStream.end();
  await new Promise(resolve => fileStream.on('finish', resolve));

  console.log('Successfully downloaded yt-dlp.exe to', targetPath);
  console.log('Final file size:', (fs.statSync(targetPath).size / 1024 / 1024).toFixed(2), 'MB');
} catch (err) {
  console.error('Error downloading yt-dlp:', err);
  process.exit(1);
}
