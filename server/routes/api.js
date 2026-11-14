import express from 'express';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { analyzeVideo, executeDownload, cancelJob, getFfmpegPath } from '../services/downloader.js';
import { listDownloadedFiles, deleteDownloadedFile, openDownloadsFolder, getDownloadsDir } from '../services/storage.js';

const router = express.Router();

// Store job states in memory
const jobStore = new Map();
const sseClients = new Map(); // jobId -> Set of response objects

function notifySse(jobId, data) {
  const clients = sseClients.get(jobId);
  if (clients) {
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    for (const res of clients) {
      try {
        res.write(payload);
      } catch (e) {
        // client disconnected
      }
    }
  }
}

// 1. System status check
router.get('/system/status', (req, res) => {
  const ffmpeg = getFfmpegPath();
  const ffmpegReady = fs.existsSync(ffmpeg) && (fs.statSync(ffmpeg).size > 10000000);
  
  res.json({
    ok: true,
    engine: 'distube-ytdl-native',
    ffmpeg: {
      path: ffmpeg,
      ready: ffmpegReady
    },
    downloadsDir: getDownloadsDir()
  });
});

// 2. Analyze YouTube URL
router.post('/analyze', async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'A valid YouTube URL is required' });
  }

  const ytRegex = /^(https?:\/\/)?(www\.|m\.)?(youtube\.com|youtu\.be)\/.+$/;
  if (!ytRegex.test(url.trim())) {
    return res.status(400).json({ error: 'Please enter a valid YouTube video URL (e.g. https://www.youtube.com/watch?v=...)' });
  }

  try {
    const info = await analyzeVideo(url.trim());
    res.json({ ok: true, data: info });
  } catch (err) {
    console.error('Error analyzing video:', err);
    res.status(500).json({ error: err.message || 'Failed to analyze video' });
  }
});

// 3. Start download
router.post('/download', (req, res) => {
  const { url, mode, videoItag, audioItag, audioLanguage, audioTrackId, container } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }
  if (!['both', 'video_only', 'audio_only'].includes(mode)) {
    return res.status(400).json({ error: 'Invalid mode. Must be both, video_only, or audio_only' });
  }

  const jobId = crypto.randomUUID();
  const initialJobState = {
    jobId,
    url,
    mode,
    videoItag,
    audioItag,
    audioLanguage: audioLanguage || 'Default / Original',
    audioTrackId: audioTrackId || null,
    container: container || 'mp4',
    status: 'starting',
    percent: '0%',
    speed: '--',
    eta: '--',
    totalSize: '--',
    message: 'Starting download...',
    createdAt: new Date().toISOString()
  };

  jobStore.set(jobId, initialJobState);

  executeDownload(jobId, { url, mode, videoItag, audioItag, audioLanguage, audioTrackId, container }, {
    onProgress: (progress) => {
      const current = jobStore.get(jobId) || initialJobState;
      const updated = { ...current, ...progress, updatedAt: new Date().toISOString() };
      jobStore.set(jobId, updated);
      notifySse(jobId, updated);
    },
    onComplete: (result) => {
      const current = jobStore.get(jobId) || initialJobState;
      const completedState = {
        ...current,
        ...result,
        percent: '100%',
        status: 'completed',
        completedAt: new Date().toISOString()
      };
      jobStore.set(jobId, completedState);
      notifySse(jobId, completedState);

      setTimeout(() => {
        const clients = sseClients.get(jobId);
        if (clients) {
          for (const c of clients) {
            try { c.end(); } catch (e) {}
          }
          sseClients.delete(jobId);
        }
      }, 3000);
    },
    onError: (err) => {
      const current = jobStore.get(jobId) || initialJobState;
      const errorState = {
        ...current,
        status: 'error',
        error: err.message || 'Download failed',
        failedAt: new Date().toISOString()
      };
      jobStore.set(jobId, errorState);
      notifySse(jobId, errorState);
    }
  });

  res.json({ ok: true, jobId });
});

// 4. Polling endpoint for job status
router.get('/download/status/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = jobStore.get(jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json({ ok: true, data: job });
});

// 5. SSE stream for real-time progress
router.get('/download/progress/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = jobStore.get(jobId);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  if (job) {
    res.write(`data: ${JSON.stringify(job)}\n\n`);
  }

  if (!sseClients.has(jobId)) {
    sseClients.set(jobId, new Set());
  }
  sseClients.get(jobId).add(res);

  req.on('close', () => {
    const clients = sseClients.get(jobId);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) {
        sseClients.delete(jobId);
      }
    }
  });
});

// 6. Cancel download
router.post('/download/cancel/:jobId', (req, res) => {
  const { jobId } = req.params;
  const result = cancelJob(jobId);
  if (result.success) {
    const job = jobStore.get(jobId);
    if (job) {
      const cancelledState = { ...job, status: 'cancelled', message: 'Cancelled by user' };
      jobStore.set(jobId, cancelledState);
      notifySse(jobId, cancelledState);
    }
    return res.json({ ok: true });
  }
  res.status(400).json({ error: result.error });
});

// 7. List downloaded files
router.get('/files', (req, res) => {
  const files = listDownloadedFiles();
  res.json({ ok: true, data: files });
});

// 8. Delete downloaded file
router.delete('/files/:fileName', (req, res) => {
  const { fileName } = req.params;
  const result = deleteDownloadedFile(fileName);
  if (result.success) {
    return res.json({ ok: true });
  }
  res.status(404).json({ error: result.error });
});

// 9. Download file to browser
router.get('/files/download/:fileName', (req, res) => {
  const { fileName } = req.params;
  const safeName = path.basename(fileName);
  const filePath = path.join(getDownloadsDir(), safeName);

  if (fs.existsSync(filePath)) {
    return res.download(filePath, safeName);
  }
  res.status(404).json({ error: 'File not found' });
});

// 10. Open downloads folder in Explorer
router.post('/files/open-folder', (req, res) => {
  const result = openDownloadsFolder();
  res.json({ ok: true, data: result });
});

export default router;
