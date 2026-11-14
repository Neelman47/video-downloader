import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import apiRouter from './routes/api.js';
import { getDownloadsDir, initStorage } from './services/storage.js';
import { getFfmpegPath } from './services/downloader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../');

const app = express();
const PORT = process.env.PORT || 5000;

// Ensure storage subfolders exist
initStorage();

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
  const localUrl = `http://localhost:${PORT}`;
  const ffmpegPath = getFfmpegPath();
  const ffmpegReady = fs.existsSync(ffmpegPath);

  console.log('\n=============================================================');
  console.log('🎬 StreamVault YouTube Downloader is RUNNING!');
  console.log(`👉 App Web URL:       ${localUrl}`);
  console.log(`👉 Backend API:       ${localUrl}/api`);
  console.log(`📂 Downloads Folder:  ${getDownloadsDir()}`);
  console.log(`🔧 FFmpeg Binary:     ${ffmpegPath} (${ffmpegReady ? 'Ready' : 'Fallback'})`);
  console.log('=============================================================\n');
});
