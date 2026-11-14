import express from 'express';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import {
  analyzeVideo,
  analyzePlaylist,
  downloadSubtitle,
  executeDownload,
  cancelJob,
  getFfmpegPath
} from '../services/downloader.js';
import {
  listDownloadedFiles,
  deleteDownloadedFile,
  deleteMultipleFiles,
  deleteAllFiles,
  openDownloadsFolder,
  getDownloadsDir,
  SUBFOLDERS
} from '../services/storage.js';

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
  const ffmpegReady = fs.existsSync(ffmpeg) && (fs.statSync(ffmpeg).size > 1000000);
  
  res.json({
    ok: true,
    engine: 'distube-ytdl-native',
    ffmpeg: {
      path: ffmpeg,
      ready: ffmpegReady
    },
    downloadsDir: getDownloadsDir(),
    subfolders: SUBFOLDERS
  });
});

// 2. Analyze YouTube Video URL
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

// 3. Analyze YouTube Playlist URL
router.post('/playlist/analyze', async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'A valid YouTube playlist URL is required' });
  }

  try {
    const info = await analyzePlaylist(url.trim());
    res.json({ ok: true, data: info });
  } catch (err) {
    console.error('Error analyzing playlist:', err);
    res.status(500).json({ error: err.message || 'Failed to analyze playlist' });
  }
});

// 4. Download Subtitle Track
router.post('/download/subtitle', async (req, res) => {
  const { url, languageCode, format = 'srt', title, videoId } = req.body;
  if (!url || !languageCode) {
    return res.status(400).json({ error: 'Video URL and languageCode are required' });
  }

  try {
    const result = await downloadSubtitle(url, { languageCode, format, title, videoId });
    res.json({ ok: true, data: result });
  } catch (err) {
    console.error('Error downloading subtitle:', err);
    res.status(500).json({ error: err.message || 'Failed to download subtitle' });
  }
});

// 5. Start single download (supports trimming & subfolders)
router.post('/download', (req, res) => {
  const {
    url,
    mode,
    videoItag,
    audioItag,
    audioLanguage,
    audioTrackId,
    container,
    trimStart,
    trimEnd,
    subfolderOverride
  } = req.body;

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
    trimStart: trimStart || null,
    trimEnd: trimEnd || null,
    status: 'starting',
    percent: '0%',
    speed: '--',
    eta: '--',
    totalSize: '--',
    message: 'Starting download...',
    createdAt: new Date().toISOString()
  };

  jobStore.set(jobId, initialJobState);

  executeDownload(jobId, {
    url,
    mode,
    videoItag,
    audioItag,
    audioLanguage,
    audioTrackId,
    container,
    trimStart,
    trimEnd,
    subfolderOverride
  }, {
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

// 6. Polling endpoint for job status
router.get('/download/status/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = jobStore.get(jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json({ ok: true, data: job });
});

// 7. SSE stream for real-time progress
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

// 8. Cancel download
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

// 9. List downloaded files across all subfolders
router.get('/files', (req, res) => {
  const files = listDownloadedFiles();
  res.json({ ok: true, data: files });
});

// 10. Delete single downloaded file (by relative path or name)
router.delete('/files/:fileName', (req, res) => {
  const { fileName } = req.params;
  const result = deleteDownloadedFile(fileName);
  if (result.success) {
    return res.json({ ok: true });
  }
  res.status(404).json({ error: result.error });
});

// 11. Delete multiple selected files
router.post('/files/delete-multiple', (req, res) => {
  const { files } = req.body;
  if (!Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: 'files must be a non-empty array of file identifiers' });
  }
  const result = deleteMultipleFiles(files);
  res.json({ ok: true, data: result });
});

// 12. Delete ALL downloaded files
router.post('/files/delete-all', (req, res) => {
  const result = deleteAllFiles();
  res.json({ ok: true, data: result });
});

// 13. Download file to browser (supports relative path in query or route param)
function handleFileSend(targetRelOrName, res) {
  const cleanRelative = targetRelOrName.replace(/^[\/\\]+/, '').replace(/\.\.[\/\\]/g, '');
  const downloadsDir = getDownloadsDir();
  let targetPath = path.join(downloadsDir, cleanRelative);

  if (!fs.existsSync(targetPath)) {
    for (const folder of Object.values(SUBFOLDERS)) {
      const candidate = path.join(downloadsDir, folder, path.basename(cleanRelative));
      if (fs.existsSync(candidate)) {
        targetPath = candidate;
        break;
      }
    }
  }

  if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
    return res.download(targetPath, path.basename(targetPath));
  }
  return res.status(404).json({ error: 'File not found' });
}

router.get('/files/download', (req, res) => {
  const file = req.query.file;
  if (!file) return res.status(400).json({ error: 'file parameter is required' });
  return handleFileSend(file, res);
});

router.get('/files/download/:fileName', (req, res) => {
  return handleFileSend(req.params.fileName, res);
});

// 14. Open downloads folder in File Explorer / Finder / xdg-open
router.post('/files/open-folder', (req, res) => {
  const { subfolder = '' } = req.body || {};
  const result = openDownloadsFolder(subfolder);
  res.json({ ok: true, data: result });
});

export default router;
