import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { getDownloadsDir, formatBytes } from './storage.js';

const require = createRequire(import.meta.url);
const { Ytdl } = require('@distube/ytdl-core');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

const ytdl = new Ytdl();
const activeJobs = new Map();

// Helper to sanitize filenames for Windows/Linux/Mac
export function sanitizeFileName(name) {
  return (name || 'video')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .trim()
    .slice(0, 150);
}

// Format duration
export function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const sec = Math.floor(seconds % 60);
  const min = Math.floor((seconds / 60) % 60);
  const hrs = Math.floor(seconds / 3600);
  const paddedSec = sec < 10 ? `0${sec}` : sec;
  if (hrs > 0) {
    const paddedMin = min < 10 ? `0${min}` : min;
    return `${hrs}:${paddedMin}:${paddedSec}`;
  }
  return `${min}:${paddedSec}`;
}

// Find available ffmpeg executable across Windows, macOS, and Linux
export function getFfmpegPath() {
  // 1. Check bundled @ffmpeg-installer
  if (ffmpegInstaller && ffmpegInstaller.path && fs.existsSync(ffmpegInstaller.path)) {
    try {
      if (process.platform !== 'win32') {
        fs.chmodSync(ffmpegInstaller.path, 0o755);
      }
      return ffmpegInstaller.path;
    } catch (e) {
      return ffmpegInstaller.path;
    }
  }

  // 2. Check local project bin folder
  const binName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  const binPath = path.join(rootDir, 'bin', binName);
  if (fs.existsSync(binPath)) {
    try {
      if (process.platform !== 'win32') {
        fs.chmodSync(binPath, 0o755);
      }
      return binPath;
    } catch (e) {
      return binPath;
    }
  }

  // 3. Fallback to system PATH (e.g. Homebrew on Mac, APT on Linux)
  return 'ffmpeg';
}

/**
 * Analyze YouTube video URL and return video info, available video qualities, and audio languages
 */
export async function analyzeVideo(url) {
  const info = await ytdl.getInfo(url);
  const videoDetails = info.videoDetails;
  const formats = info.formats || [];

  // 1. Parse Video Qualities
  const videoFormats = formats.filter(f => f.hasVideo);
  const qualityMap = new Map();

  for (const f of videoFormats) {
    const rawLabel = f.qualityLabel || `${f.height || 360}p`;
    // Clean label: e.g. 1080p60 -> 1080p (60fps)
    const height = f.height || parseInt(rawLabel) || 360;
    const fps = f.fps || 30;
    const is60 = fps >= 50;
    const displayLabel = height >= 2160 ? `4K (2160p${is60 ? ' 60fps' : ''})` :
                         height >= 1440 ? `2K (1440p${is60 ? ' 60fps' : ''})` :
                         height >= 1080 ? `1080p (Full HD${is60 ? ' 60fps' : ''})` :
                         height >= 720  ? `720p (HD${is60 ? ' 60fps' : ''})` :
                         height >= 480  ? '480p' :
                         height >= 360  ? '360p' :
                         height >= 240  ? '240p' :
                         height >= 144  ? '144p' : `${height}p`;

    const container = (f.container || f.mimeType?.split(';')[0]?.split('/')[1] || 'mp4').toLowerCase();
    const isAvc = (f.mimeType || '').includes('avc1') || (f.mimeType || '').includes('h264');
    
    // Calculate approximate size
    let approxBytes = f.contentLength ? parseInt(f.contentLength) : null;
    if (!approxBytes && f.bitrate && videoDetails.lengthSeconds) {
      approxBytes = Math.round((f.bitrate * videoDetails.lengthSeconds) / 8);
    }

    const item = {
      itag: f.itag,
      rawLabel,
      displayLabel,
      height,
      fps,
      container,
      mimeType: f.mimeType,
      hasAudio: f.hasAudio,
      isProgressive: f.hasAudio && f.hasVideo,
      approxBytes,
      approxSizeFormatted: approxBytes ? formatBytes(approxBytes) : 'Unknown size',
      isAvc,
      bitrate: f.bitrate || 0
    };

    const key = `${height}p_${is60 ? 60 : 30}`;
    const existing = qualityMap.get(key);
    if (!existing) {
      qualityMap.set(key, item);
    } else {
      // Prefer AVC/H.264 mp4 or higher bitrate
      if ((isAvc && !existing.isAvc) || (item.bitrate > existing.bitrate && (isAvc || !existing.isAvc))) {
        qualityMap.set(key, item);
      }
    }
  }

  const availableVideoQualities = Array.from(qualityMap.values())
    .sort((a, b) => b.height - a.height || b.fps - a.fps);

  // 2. Parse Audio Languages & Tracks
  const audioFormats = formats.filter(f => f.hasAudio);
  const audioLanguageMap = new Map();

  for (const f of audioFormats) {
    let langCode = 'default';
    let langDisplayName = 'Default / Original Audio';
    let isDefault = true;
    let trackId = null;

    if (f.audioTrack) {
      langDisplayName = f.audioTrack.displayName || 'Original Audio';
      langCode = (f.audioTrack.id || 'default').split('.')[0];
      trackId = f.audioTrack.id;
      isDefault = !!f.audioTrack.audioIsDefault;
    }

    const container = (f.container || f.mimeType?.split(';')[0]?.split('/')[1] || 'm4a').toLowerCase();
    const bitrate = f.audioBitrate || Math.round((f.bitrate || 128000) / 1000);
    
    let approxBytes = f.contentLength ? parseInt(f.contentLength) : null;
    if (!approxBytes && f.bitrate && videoDetails.lengthSeconds) {
      approxBytes = Math.round((f.bitrate * videoDetails.lengthSeconds) / 8);
    }

    const audioOption = {
      itag: f.itag,
      trackId,
      languageCode: langCode,
      languageName: langDisplayName,
      isDefault,
      container,
      bitrate: `${bitrate} kbps`,
      bitrateValue: bitrate,
      mimeType: f.mimeType,
      approxBytes,
      approxSizeFormatted: approxBytes ? formatBytes(approxBytes) : 'Unknown size'
    };

    if (!audioLanguageMap.has(langDisplayName)) {
      audioLanguageMap.set(langDisplayName, []);
    }
    audioLanguageMap.get(langDisplayName).push(audioOption);
  }

  const audioLanguages = [];
  for (const [langName, tracks] of audioLanguageMap.entries()) {
    tracks.sort((a, b) => b.bitrateValue - a.bitrateValue);
    const best = tracks[0];
    audioLanguages.push({
      languageName: langName,
      languageCode: best.languageCode,
      trackId: best.trackId,
      isDefault: best.isDefault,
      bestItag: best.itag,
      bestBitrate: best.bitrate,
      tracks: tracks
    });
  }

  // Put default/original audio at the top
  audioLanguages.sort((a, b) => {
    if (a.isDefault || a.languageName.includes('Original') || a.languageName.includes('Default')) return -1;
    if (b.isDefault || b.languageName.includes('Original') || b.languageName.includes('Default')) return 1;
    return a.languageName.localeCompare(b.languageName);
  });

  // Best progressive format (has both video & audio built-in)
  const progressiveFormats = formats.filter(f => f.hasVideo && f.hasAudio)
    .sort((a, b) => (b.height || 0) - (a.height || 0));

  const actualId = videoDetails.id || videoDetails.videoId || (url.match(/(?:v=|youtu\.be\/)([\w-]{11})/)?.[1]) || '';
  const actualUrl = videoDetails.url || (actualId ? `https://www.youtube.com/watch?v=${actualId}` : url);

  return {
    id: actualId,
    webpageUrl: actualUrl,
    title: videoDetails.title,
    description: (videoDetails.description || '').slice(0, 300),
    thumbnail: videoDetails.thumbnails?.[videoDetails.thumbnails.length - 1]?.url || null,
    duration: parseInt(videoDetails.lengthSeconds) || 0,
    durationFormatted: formatDuration(videoDetails.lengthSeconds),
    channel: videoDetails.author?.name || 'Unknown Channel',
    channelUrl: videoDetails.author?.channel_url || null,
    viewCount: parseInt(videoDetails.viewCount) || 0,
    viewCountFormatted: videoDetails.viewCount ? new Intl.NumberFormat('en', { notation: 'compact' }).format(videoDetails.viewCount) : '0',
    uploadDate: videoDetails.uploadDate || '',
    availableVideoQualities,
    audioLanguages,
    hasMultipleAudioLanguages: audioLanguages.length > 1,
    progressiveCount: progressiveFormats.length
  };
}

/**
 * Resolve the exact audio format based on language, track ID, and itag
 */
export function resolveAudioFormat(formats, { audioTrackId, audioLanguage, audioItag }) {
  const audioOnly = formats.filter(f => f.hasAudio && !f.hasVideo);
  const pool = audioOnly.length > 0 ? audioOnly : formats.filter(f => f.hasAudio);

  // 1. Match by exact trackId (e.g. 'hi.3')
  if (audioTrackId) {
    const match = pool.find(f => f.audioTrack?.id === audioTrackId && (!audioItag || f.itag === parseInt(audioItag))) ||
                  pool.find(f => f.audioTrack?.id === audioTrackId);
    if (match) return match;
  }

  // 2. Match by audioLanguage (e.g. 'Hindi')
  if (audioLanguage && !audioLanguage.includes('Original') && !audioLanguage.includes('Default')) {
    const clean = audioLanguage.toLowerCase().trim();
    const match = pool.find(f => {
      if (!f.audioTrack) return false;
      const name = (f.audioTrack.displayName || '').toLowerCase().trim();
      const id = (f.audioTrack.id || '').toLowerCase().trim();
      return (name === clean || id.startsWith(clean)) && (!audioItag || f.itag === parseInt(audioItag));
    }) || pool.find(f => {
      if (!f.audioTrack) return false;
      const name = (f.audioTrack.displayName || '').toLowerCase().trim();
      const id = (f.audioTrack.id || '').toLowerCase().trim();
      return name === clean || id.startsWith(clean);
    });
    if (match) return match;
  }

  // 3. Match Default / Original audio
  if (audioLanguage && (audioLanguage.includes('Original') || audioLanguage.includes('Default'))) {
    const def = pool.find(f => f.audioTrack?.audioIsDefault) ||
                pool.find(f => (f.audioTrack?.displayName || '').toLowerCase().includes('original')) ||
                pool.find(f => !f.audioTrack);
    if (def) return def;
  }

  // 4. Fallback by itag
  if (audioItag) {
    const itagMatch = pool.find(f => f.itag === parseInt(audioItag));
    if (itagMatch) return itagMatch;
  }

  // 5. Ultimate fallback: highest bitrate
  return pool.sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0))[0];
}

/**
 * Execute download based on selection
 */
export async function executeDownload(jobId, options, callbacks) {
  const { url, mode, videoItag, audioItag, audioLanguage, audioTrackId, container = 'mp4' } = options;
  const { onProgress, onComplete, onError } = callbacks;

  const downloadsDir = getDownloadsDir();

  try {
    const info = await ytdl.getInfo(url);
    const safeTitle = sanitizeFileName(info.videoDetails?.title || 'video');
    const videoId = info.videoDetails?.videoId || info.videoDetails?.id || (url.match(/(?:v=|youtu\.be\/)([\w-]{11})/)?.[1]) || 'video';

    let targetFileName = '';
    let targetFilePath = '';

    const abortController = {
      aborted: false,
      streams: [],
      ffmpegProc: null
    };
    activeJobs.set(jobId, abortController);

    // MODE 1: Audio Only
    if (mode === 'audio_only') {
      const audioFormat = resolveAudioFormat(info.formats, { audioTrackId, audioLanguage, audioItag });
      const langLabel = audioFormat.audioTrack?.displayName || audioLanguage;
      const langTag = langLabel && !langLabel.includes('Original') && !langLabel.includes('Default') ? ` [${sanitizeFileName(langLabel)}]` : '';

      const ext = container === 'mp3' ? 'mp3' : (audioFormat.container || 'm4a');
      targetFileName = `${safeTitle} [Audio${langTag}] [${videoId}].${ext}`;
      targetFilePath = path.join(downloadsDir, targetFileName);

      console.log(`[Job ${jobId}] Selected Audio Track:`, audioFormat.audioTrack?.displayName || 'Original', 'ID:', audioFormat.audioTrack?.id, 'Itag:', audioFormat.itag);

      const stream = await ytdl.download(url, { format: audioFormat });
      abortController.streams.push(stream);

      const writeStream = fs.createWriteStream(targetFilePath);
      let downloaded = 0;
      const total = audioFormat.contentLength ? parseInt(audioFormat.contentLength) : 0;
      let startTime = Date.now();
      let lastReport = Date.now();

      stream.on('data', chunk => {
        if (abortController.aborted) return;
        downloaded += chunk.length;
        writeStream.write(chunk);

        const now = Date.now();
        if (now - lastReport >= 300) {
          const elapsedSec = (now - startTime) / 1000;
          const speedBytesPerSec = downloaded / (elapsedSec || 1);
          const percent = total ? Math.min(99, Math.round((downloaded / total) * 100)) : 50;
          const etaSec = total ? Math.round((total - downloaded) / (speedBytesPerSec || 1)) : 0;

          onProgress({
            percent: `${percent}%`,
            speed: `${formatBytes(speedBytesPerSec)}/s`,
            eta: total ? `${etaSec}s` : '--',
            totalSize: total ? formatBytes(total) : formatBytes(downloaded),
            status: 'downloading',
            message: 'Downloading audio track...'
          });
          lastReport = now;
        }
      });

      stream.on('end', () => {
        writeStream.end();
        activeJobs.delete(jobId);
        const finalSize = fs.existsSync(targetFilePath) ? fs.statSync(targetFilePath).size : downloaded;
        onComplete({
          jobId,
          fileName: targetFileName,
          filePath: targetFilePath,
          fileSize: finalSize,
          fileSizeFormatted: formatBytes(finalSize),
          status: 'completed'
        });
      });

      stream.on('error', err => {
        writeStream.end();
        activeJobs.delete(jobId);
        onError(err);
      });

      return;
    }

    // MODE 2: Video Only
    if (mode === 'video_only') {
      const selectedVideoItag = parseInt(videoItag);
      const videoFormat = info.formats.find(f => f.itag === selectedVideoItag) || 
                          info.formats.filter(f => f.hasVideo).sort((a, b) => (b.height || 0) - (a.height || 0))[0];

      const ext = videoFormat.container || 'mp4';
      targetFileName = `${safeTitle} [Video Only] [${videoId}].${ext}`;
      targetFilePath = path.join(downloadsDir, targetFileName);

      const stream = await ytdl.download(url, { format: videoFormat });
      abortController.streams.push(stream);

      const writeStream = fs.createWriteStream(targetFilePath);
      let downloaded = 0;
      const total = videoFormat.contentLength ? parseInt(videoFormat.contentLength) : 0;
      let startTime = Date.now();
      let lastReport = Date.now();

      stream.on('data', chunk => {
        if (abortController.aborted) return;
        downloaded += chunk.length;
        writeStream.write(chunk);

        const now = Date.now();
        if (now - lastReport >= 300) {
          const elapsedSec = (now - startTime) / 1000;
          const speedBytesPerSec = downloaded / (elapsedSec || 1);
          const percent = total ? Math.min(99, Math.round((downloaded / total) * 100)) : 50;
          const etaSec = total ? Math.round((total - downloaded) / (speedBytesPerSec || 1)) : 0;

          onProgress({
            percent: `${percent}%`,
            speed: `${formatBytes(speedBytesPerSec)}/s`,
            eta: total ? `${etaSec}s` : '--',
            totalSize: total ? formatBytes(total) : formatBytes(downloaded),
            status: 'downloading',
            message: 'Downloading video stream...'
          });
          lastReport = now;
        }
      });

      stream.on('end', () => {
        writeStream.end();
        activeJobs.delete(jobId);
        const finalSize = fs.existsSync(targetFilePath) ? fs.statSync(targetFilePath).size : downloaded;
        onComplete({
          jobId,
          fileName: targetFileName,
          filePath: targetFilePath,
          fileSize: finalSize,
          fileSizeFormatted: formatBytes(finalSize),
          status: 'completed'
        });
      });

      stream.on('error', err => {
        writeStream.end();
        activeJobs.delete(jobId);
        onError(err);
      });

      return;
    }

    // MODE 3: Both (Video + Audio)
    const selectedVideoItag = parseInt(videoItag);
    const audioFormat = resolveAudioFormat(info.formats, { audioTrackId, audioLanguage, audioItag });

    const videoFormat = info.formats.find(f => f.itag === selectedVideoItag) || 
                        info.formats.filter(f => f.hasVideo).sort((a, b) => (b.height || 0) - (a.height || 0))[0];

    const isCustomLanguage = audioLanguage && !audioLanguage.includes('Original') && !audioLanguage.includes('Default');

    console.log(`[Job ${jobId}] Target Video: ${videoFormat?.qualityLabel || videoFormat?.height + 'p'}, Target Audio: ${audioFormat?.audioTrack?.displayName || 'Original'} (ID: ${audioFormat?.audioTrack?.id}, Itag: ${audioFormat?.itag})`);

    // Check if chosen format is ALREADY progressive (has both audio + video) AND user picked Original/Default
    if (videoFormat && videoFormat.hasAudio && !isCustomLanguage && (!audioItag || videoFormat.itag === audioFormat.itag)) {
      const ext = videoFormat.container || 'mp4';
      targetFileName = `${safeTitle} [${videoId}].${ext}`;
      targetFilePath = path.join(downloadsDir, targetFileName);

      const stream = await ytdl.download(url, { format: videoFormat });
      abortController.streams.push(stream);

      const writeStream = fs.createWriteStream(targetFilePath);
      let downloaded = 0;
      const total = videoFormat.contentLength ? parseInt(videoFormat.contentLength) : 0;
      let startTime = Date.now();
      let lastReport = Date.now();

      stream.on('data', chunk => {
        if (abortController.aborted) return;
        downloaded += chunk.length;
        writeStream.write(chunk);

        const now = Date.now();
        if (now - lastReport >= 300) {
          const elapsedSec = (now - startTime) / 1000;
          const speedBytesPerSec = downloaded / (elapsedSec || 1);
          const percent = total ? Math.min(99, Math.round((downloaded / total) * 100)) : 50;
          const etaSec = total ? Math.round((total - downloaded) / (speedBytesPerSec || 1)) : 0;

          onProgress({
            percent: `${percent}%`,
            speed: `${formatBytes(speedBytesPerSec)}/s`,
            eta: total ? `${etaSec}s` : '--',
            totalSize: total ? formatBytes(total) : formatBytes(downloaded),
            status: 'downloading',
            message: 'Downloading video & audio...'
          });
          lastReport = now;
        }
      });

      stream.on('end', () => {
        writeStream.end();
        activeJobs.delete(jobId);
        const finalSize = fs.existsSync(targetFilePath) ? fs.statSync(targetFilePath).size : downloaded;
        onComplete({
          jobId,
          fileName: targetFileName,
          filePath: targetFilePath,
          fileSize: finalSize,
          fileSizeFormatted: formatBytes(finalSize),
          status: 'completed'
        });
      });

      stream.on('error', err => {
        writeStream.end();
        activeJobs.delete(jobId);
        onError(err);
      });

      return;
    }

    // Separate Video + Separate Audio (requires muxing)
    const langLabel = audioFormat?.audioTrack?.displayName || audioLanguage;
    const langTag = langLabel && !langLabel.includes('Original') && !langLabel.includes('Default') ? ` [${sanitizeFileName(langLabel)}]` : '';

    const ext = container || 'mp4';
    targetFileName = `${safeTitle}${langTag} [${videoId}].${ext}`;
    targetFilePath = path.join(downloadsDir, targetFileName);
    targetFilePath = path.join(downloadsDir, targetFileName);

    const tempVideoPath = path.join(downloadsDir, `temp_${jobId}_video.mp4`);
    const tempAudioPath = path.join(downloadsDir, `temp_${jobId}_audio.m4a`);

    // Download video stream to temp file
    onProgress({
      percent: '10%',
      speed: '--',
      eta: '--',
      totalSize: 'Calculating...',
      status: 'downloading',
      message: 'Downloading video stream...'
    });

    const vStream = await ytdl.download(url, { format: videoFormat });
    abortController.streams.push(vStream);
    const vWriteStream = fs.createWriteStream(tempVideoPath);

    let vDownloaded = 0;
    const vTotal = videoFormat.contentLength ? parseInt(videoFormat.contentLength) : 0;
    let vStartTime = Date.now();
    let vLastReport = Date.now();

    await new Promise((resolve, reject) => {
      vStream.on('data', chunk => {
        if (abortController.aborted) return;
        vDownloaded += chunk.length;
        vWriteStream.write(chunk);

        const now = Date.now();
        if (now - vLastReport >= 300) {
          const elapsedSec = (now - vStartTime) / 1000;
          const speedBytesPerSec = vDownloaded / (elapsedSec || 1);
          // Scale video progress from 0% to 70%
          const vPercent = vTotal ? Math.round((vDownloaded / vTotal) * 70) : 35;
          const etaSec = vTotal ? Math.round((vTotal - vDownloaded) / (speedBytesPerSec || 1)) : 0;

          onProgress({
            percent: `${vPercent}%`,
            speed: `${formatBytes(speedBytesPerSec)}/s`,
            eta: vTotal ? `${etaSec}s` : '--',
            totalSize: vTotal ? formatBytes(vTotal) : formatBytes(vDownloaded),
            status: 'downloading',
            message: `Downloading video stream (${videoFormat.qualityLabel || 'HD'})...`
          });
          vLastReport = now;
        }
      });
      vStream.on('end', () => {
        vWriteStream.end();
        resolve();
      });
      vStream.on('error', err => {
        vWriteStream.end();
        reject(err);
      });
    });

    if (abortController.aborted) return;

    // Download audio stream to temp file
    onProgress({
      percent: '70%',
      speed: '--',
      eta: '--',
      totalSize: 'Calculating...',
      status: 'downloading',
      message: 'Downloading audio stream...'
    });

    const aStream = await ytdl.download(url, { format: audioFormat });
    abortController.streams.push(aStream);
    const aWriteStream = fs.createWriteStream(tempAudioPath);

    let aDownloaded = 0;
    const aTotal = audioFormat.contentLength ? parseInt(audioFormat.contentLength) : 0;
    let aStartTime = Date.now();
    let aLastReport = Date.now();

    await new Promise((resolve, reject) => {
      aStream.on('data', chunk => {
        if (abortController.aborted) return;
        aDownloaded += chunk.length;
        aWriteStream.write(chunk);

        const now = Date.now();
        if (now - aLastReport >= 300) {
          const elapsedSec = (now - aStartTime) / 1000;
          const speedBytesPerSec = aDownloaded / (elapsedSec || 1);
          // Scale audio progress from 70% to 90%
          const aPercent = aTotal ? 70 + Math.round((aDownloaded / aTotal) * 20) : 80;

          onProgress({
            percent: `${aPercent}%`,
            speed: `${formatBytes(speedBytesPerSec)}/s`,
            eta: '--',
            totalSize: aTotal ? formatBytes(aTotal) : formatBytes(aDownloaded),
            status: 'downloading',
            message: `Downloading audio stream (${audioFormat.audioTrack?.displayName || 'Original'})...`
          });
          aLastReport = now;
        }
      });
      aStream.on('end', () => {
        aWriteStream.end();
        resolve();
      });
      aStream.on('error', err => {
        aWriteStream.end();
        reject(err);
      });
    });

    if (abortController.aborted) return;

    // Mux video & audio using ffmpeg
    onProgress({
      percent: '92%',
      speed: '--',
      eta: '--',
      totalSize: formatBytes(vDownloaded + aDownloaded),
      status: 'merging',
      message: 'Merging video and audio into final MP4 with FFmpeg...'
    });

    const ffmpegPath = getFfmpegPath();
    const ffmpegArgs = [
      '-i', tempVideoPath,
      '-i', tempAudioPath,
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-map', '0:v:0',
      '-map', '1:a:0',
      '-shortest',
      '-y',
      targetFilePath
    ];

    const ffmpegProc = spawn(ffmpegPath, ffmpegArgs, { windowsHide: true });
    abortController.ffmpegProc = ffmpegProc;

    let ffmpegErr = '';
    ffmpegProc.stderr.on('data', d => { ffmpegErr += d.toString(); });

    ffmpegProc.on('close', code => {
      // Clean up temporary files
      try { if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath); } catch (e) {}
      try { if (fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath); } catch (e) {}
      activeJobs.delete(jobId);

      if (code === 0 && fs.existsSync(targetFilePath)) {
        const finalSize = fs.statSync(targetFilePath).size;
        onComplete({
          jobId,
          fileName: targetFileName,
          filePath: targetFilePath,
          fileSize: finalSize,
          fileSizeFormatted: formatBytes(finalSize),
          status: 'completed'
        });
      } else {
        onError(new Error(ffmpegErr.trim() || `FFmpeg failed with exit code ${code}`));
      }
    });

    ffmpegProc.on('error', err => {
      try { if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath); } catch (e) {}
      try { if (fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath); } catch (e) {}
      activeJobs.delete(jobId);
      onError(err);
    });

  } catch (err) {
    activeJobs.delete(jobId);
    onError(err);
  }
}

export function cancelJob(jobId) {
  const job = activeJobs.get(jobId);
  if (job) {
    job.aborted = true;
    for (const s of job.streams) {
      try { s.destroy(); } catch (e) {}
    }
    if (job.ffmpegProc) {
      try { job.ffmpegProc.kill(); } catch (e) {}
    }
    activeJobs.delete(jobId);
    return { success: true };
  }
  return { success: false, error: 'Job not found' };
}
