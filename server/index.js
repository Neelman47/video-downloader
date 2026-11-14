import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import apiRouter from './routes/api.js';
import { checkBinaries } from './services/binManager.js';
import { getDownloadsDir } from './services/storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api', apiRouter);

// Serve static frontend in production if built
const clientDist = path.join(rootDir, 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🚀 YouTube Downloader Server running on port ${PORT}`);
  console.log(`📂 Downloads stored in: ${getDownloadsDir()}`);
  const binaries = checkBinaries();
  console.log(`🔧 yt-dlp path: ${binaries.ytDlp.path} (Ready: ${binaries.ytDlp.exists})`);
  console.log(`🔧 ffmpeg path: ${binaries.ffmpeg.path} (Ready: ${binaries.ffmpeg.exists})`);
  console.log(`==================================================\n`);
});
