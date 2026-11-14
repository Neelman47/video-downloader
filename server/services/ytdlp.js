import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { getYtDlpPath, getFfmpegPath } from './binManager.js';
import { getDownloadsDir, formatBytes } from './storage.js';

// Cache active download processes so we can cancel or monitor them
const activeJobs = new Map();

// Helper to get human friendly language name
function getLanguageName(langCode) {
  if (!langCode || langCode === 'und' || langCode === 'default') {
    return 'Default / Original';
  }
  try {
    const cleanCode = langCode.split(/[-_]/)[0];
    const displayNames = new Intl.DisplayNames(['en'], { type: 'language' });
    const name = displayNames.of(cleanCode);
    if (name) {
      if (langCode.toLowerCase().includes('orig') || langCode === 'original') {
        return `${name} (Original)`;
      }
      if (langCode.includes('-')) {
        return `${name} [${langCode}]`;
      }
      return name;
    }
  } catch (e) {
    // fallback
  }
  return langCode.toUpperCase();
}

// Format duration in seconds to hh:mm:ss or mm:ss
function formatDuration(seconds) {
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

/**
 * Fetch and analyze video information from YouTube URL
 */
export async function getVideoInfo(url) {
  const ytDlp = getYtDlpPath();
  const ffmpeg = getFfmpegPath();

  const args = [
    '--dump-single-json',
    '--no-warnings',
    '--no-check-certificates',
    '--no-playlist',
    url
  ];

  if (ffmpeg && ffmpeg !== 'ffmpeg') {
    args.push('--ffmpeg-location', path.dirname(ffmpeg));
  }

  return new Promise((resolve, reject) => {
    let stdoutData = '';
    let stderrData = '';

    const proc = spawn(ytDlp, args, { windowsHide: true });

    proc.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString();
    });

    proc.stderr.on('data', (chunk) => {
      stderrData += chunk.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(stderrData.trim() || `yt-dlp exited with code ${code}`));
      }

      try {
        const raw = JSON.parse(stdoutData);
        const parsed = parseRawVideoInfo(raw);
        resolve(parsed);
      } catch (err) {
        reject(new Error(`Failed to parse video info: ${err.message}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to execute yt-dlp: ${err.message}`));
    });
  });
}

/**
 * Parse raw yt-dlp JSON into a clean, structured object for our UI
 */
function parseRawVideoInfo(raw) {
  const formats = raw.formats || [];

  // 1. Group video options
  // Filter formats that have video
  const videoFormats = formats.filter(f => f.vcodec && f.vcodec !== 'none');
  
  // Map resolutions to clean objects
  const videoQualityMap = new Map();
  const allVideoStreams = [];

  for (const f of videoFormats) {
    const height = f.height || 0;
    const width = f.width || 0;
    const fps = f.fps || 30;
    const vcodec = (f.vcodec || '').toLowerCase();
    const isAvc = vcodec.startsWith('avc') || vcodec.startsWith('h264');
    const isVp9 = vcodec.startsWith('vp9');
    const isAv1 = vcodec.startsWith('av01');
    const hasAudio = f.acodec && f.acodec !== 'none';
    const resolutionLabel = height >= 2160 ? '4K (2160p)' :
                            height >= 1440 ? '2K (1440p)' :
                            height >= 1080 ? '1080p (Full HD)' :
                            height >= 720  ? '720p (HD)' :
                            height >= 480  ? '480p' :
                            height >= 360  ? '360p' :
                            height >= 240  ? '240p' :
                            height >= 144  ? '144p' : `${height}p`;

    const streamInfo = {
      formatId: f.format_id,
      height,
      width,
      fps,
      vcodec: f.vcodec,
      acodec: f.acodec,
      ext: f.ext,
      filesize: f.filesize || f.filesize_approx || null,
      filesizeFormatted: (f.filesize || f.filesize_approx) ? formatBytes(f.filesize || f.filesize_approx) : 'Unknown size',
      resolution: resolutionLabel,
      isAvc,
      isVp9,
      isAv1,
      hasAudio,
      tbr: f.tbr || 0
    };

    allVideoStreams.push(streamInfo);

    // Pick the best format for each distinct resolution label
    // Prefer AVC/H.264 for maximum compatibility, or higher bitrate
    const existing = videoQualityMap.get(resolutionLabel);
    if (!existing) {
      videoQualityMap.set(resolutionLabel, streamInfo);
    } else {
      // If existing is not AVC and this one is AVC, or higher bitrate/fps
      if ((isAvc && !existing.isAvc) || (f.tbr && existing.tbr && f.tbr > existing.tbr && (isAvc || !existing.isAvc))) {
        videoQualityMap.set(resolutionLabel, streamInfo);
      }
    }
  }

  // Convert video quality map to sorted array (highest resolution first)
  const availableVideoQualities = Array.from(videoQualityMap.values())
    .sort((a, b) => (b.height || 0) - (a.height || 0));

  // 2. Group Audio options (including multi-language tracks!)
  const audioFormats = formats.filter(f => f.acodec && f.acodec !== 'none' && (!f.vcodec || f.vcodec === 'none'));
  const audioTracksMap = new Map();

  for (const f of audioFormats) {
    const rawLang = f.language || (f.format_note && f.format_note.includes('original') ? 'original' : 'default');
    const langKey = rawLang.toLowerCase();
    const langName = getLanguageName(rawLang);
    const abr = Math.round(f.abr || f.tbr || 128);
    const audioCodec = f.acodec || f.ext;

    const audioOption = {
      formatId: f.format_id,
      languageCode: rawLang,
      languageName: langName,
      abr: `${abr} kbps`,
      abrValue: abr,
      acodec: audioCodec,
      ext: f.ext,
      filesize: f.filesize || f.filesize_approx || null,
      filesizeFormatted: (f.filesize || f.filesize_approx) ? formatBytes(f.filesize || f.filesize_approx) : 'Unknown size'
    };

    if (!audioTracksMap.has(langKey)) {
      audioTracksMap.set(langKey, []);
    }
    audioTracksMap.get(langKey).push(audioOption);
  }

  // If no audio-only formats found (rare), check progressive formats
  if (audioTracksMap.size === 0) {
    const progressive = formats.filter(f => f.acodec && f.acodec !== 'none');
    if (progressive.length > 0) {
      audioTracksMap.set('default', [{
        formatId: 'bestaudio',
        languageCode: 'default',
        languageName: 'Default Audio Track',
        abr: 'Standard',
        abrValue: 128,
        acodec: 'aac',
        ext: 'm4a',
        filesize: null,
        filesizeFormatted: 'Included in stream'
      }]);
    }
  }

  // Format audio languages array
  const audioLanguages = [];
  for (const [langKey, tracks] of audioTracksMap.entries()) {
    // Sort tracks by bitrate descending
    tracks.sort((a, b) => b.abrValue - a.abrValue);
    const bestTrack = tracks[0];
    audioLanguages.push({
      languageCode: langKey,
      languageName: bestTrack.languageName,
      bestFormatId: bestTrack.formatId,
      tracks: tracks
    });
  }

  // Put "Default / Original" first
  audioLanguages.sort((a, b) => {
    if (a.languageName.includes('Original') || a.languageName.includes('Default')) return -1;
    if (b.languageName.includes('Original') || b.languageName.includes('Default')) return 1;
    return a.languageName.localeCompare(b.languageName);
  });

  return {
    id: raw.id,
    title: raw.title || 'Untitled Video',
    description: (raw.description || '').slice(0, 300),
    thumbnail: raw.thumbnail || (raw.thumbnails && raw.thumbnails.length ? raw.thumbnails[raw.thumbnails.length - 1].url : null),
    duration: raw.duration || 0,
    durationFormatted: formatDuration(raw.duration),
    channel: raw.uploader || raw.channel || 'Unknown Channel',
    channelUrl: raw.uploader_url || raw.channel_url || null,
    viewCount: raw.view_count || 0,
    viewCountFormatted: raw.view_count ? new Intl.NumberFormat('en', { notation: 'compact' }).format(raw.view_count) : '0',
    uploadDate: raw.upload_date || '',
    webpageUrl: raw.webpage_url || '',
    availableVideoQualities,
    audioLanguages,
    rawFormatsCount: formats.length
  };
}

/**
 * Execute download with live progress tracking
 */
export function startDownload(jobId, options, callbacks) {
  const { url, mode, videoFormatId, audioFormatId, container = 'mp4' } = options;
  const { onProgress, onComplete, onError } = callbacks;
  const downloadsDir = getDownloadsDir();
  const ytDlp = getYtDlpPath();
  const ffmpeg = getFfmpegPath();

  // Custom output template to guarantee proper filename and prevent collisions
  const outputTemplate = path.join(downloadsDir, '%(title).150B [%(id)s].%(ext)s');

  const args = [
    '--newline',
    '--no-warnings',
    '--no-check-certificates',
    '--progress-template',
    'download:%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s|%(progress._total_bytes_estimate_str)s',
    '-o', outputTemplate
  ];

  if (ffmpeg && ffmpeg !== 'ffmpeg') {
    args.push('--ffmpeg-location', path.dirname(ffmpeg));
  }

  // Handle modes:
  // 1. both: combine video + audio
  // 2. video_only: download video without audio
  // 3. audio_only: extract or download audio track
  if (mode === 'both') {
    if (videoFormatId && audioFormatId) {
      args.push('-f', `${videoFormatId}+${audioFormatId}`);
      args.push('--merge-output-format', container);
    } else if (videoFormatId) {
      args.push('-f', `${videoFormatId}+bestaudio`);
      args.push('--merge-output-format', container);
    } else {
      args.push('-f', 'bestvideo+bestaudio');
      args.push('--merge-output-format', container);
    }
  } else if (mode === 'video_only') {
    if (videoFormatId) {
      args.push('-f', videoFormatId);
    } else {
      args.push('-f', 'bestvideo');
    }
  } else if (mode === 'audio_only') {
    const targetAudioFmt = audioFormatId || 'bestaudio';
    args.push('-f', targetAudioFmt);
    args.push('-x');
    args.push('--audio-format', ['mp3', 'm4a', 'wav', 'opus', 'flac'].includes(container) ? container : 'mp3');
  }

  args.push(url);

  console.log(`Starting job [${jobId}] with args:`, args.join(' '));

  let downloadedFilePath = null;
  let lastProgress = {
    percent: '0%',
    speed: '0 B/s',
    eta: '--:--',
    totalSize: 'Calculating...',
    status: 'downloading'
  };

  const proc = spawn(ytDlp, args, { windowsHide: true });
  activeJobs.set(jobId, { proc, options, startTime: Date.now() });

  proc.stdout.on('data', (chunk) => {
    const lines = chunk.toString().split(/\r?\n/);
    for (const line of lines) {
      if (!line) continue;

      if (line.startsWith('download:')) {
        // e.g. "download: 45.2%| 5.20MiB/s|00:15|120.50MiB"
        const parts = line.replace('download:', '').split('|');
        if (parts.length >= 4) {
          lastProgress = {
            percent: parts[0].trim(),
            speed: parts[1].trim(),
            eta: parts[2].trim(),
            totalSize: parts[3].trim(),
            status: 'downloading'
          };
          onProgress && onProgress(lastProgress);
        }
      } else if (line.includes('[Merger]') || line.includes('Merging formats')) {
        lastProgress.status = 'merging';
        lastProgress.percent = '98%';
        onProgress && onProgress({ ...lastProgress, status: 'merging', message: 'Merging video & audio streams with FFmpeg...' });
      } else if (line.includes('[ExtractAudio]')) {
        lastProgress.status = 'extracting';
        lastProgress.percent = '98%';
        onProgress && onProgress({ ...lastProgress, status: 'extracting', message: 'Extracting and converting audio...' });
      } else if (line.includes('[download] Destination:') || line.includes('Destination:')) {
        const destMatch = line.match(/Destination:\s*(.+)$/);
        if (destMatch && destMatch[1]) {
          downloadedFilePath = destMatch[1].trim();
        }
      }
    }
  });

  let stderrOutput = '';
  proc.stderr.on('data', (chunk) => {
    stderrOutput += chunk.toString();
  });

  proc.on('close', (code) => {
    activeJobs.delete(jobId);

    if (code === 0) {
      // Find the created file in downloads directory if not captured directly
      let finalFile = downloadedFilePath;
      if (!finalFile || !fs.existsSync(finalFile)) {
        // Search downloads directory for newest file modified in the last 2 minutes
        const files = fs.readdirSync(downloadsDir)
          .map(f => ({ name: f, full: path.join(downloadsDir, f), stat: fs.statSync(path.join(downloadsDir, f)) }))
          .filter(f => !f.name.endsWith('.part') && !f.name.endsWith('.ytdl'))
          .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);

        if (files.length > 0) {
          finalFile = files[0].full;
        }
      }

      const fileName = finalFile ? path.basename(finalFile) : 'Downloaded media';
      const fileSize = finalFile && fs.existsSync(finalFile) ? fs.statSync(finalFile).size : 0;

      onComplete && onComplete({
        jobId,
        fileName,
        filePath: finalFile,
        fileSize,
        fileSizeFormatted: formatBytes(fileSize),
        status: 'completed'
      });
    } else {
      onError && onError(new Error(stderrOutput.trim() || `Download failed with exit code ${code}`));
    }
  });

  proc.on('error', (err) => {
    activeJobs.delete(jobId);
    onError && onError(err);
  });

  return jobId;
}

export function cancelDownload(jobId) {
  const job = activeJobs.get(jobId);
  if (job && job.proc) {
    try {
      job.proc.kill();
      activeJobs.delete(jobId);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
  return { success: false, error: 'Job not found or already completed' };
}
