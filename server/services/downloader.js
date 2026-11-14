import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { getDownloadsDir, formatBytes, getTimestampPrefix, SUBFOLDERS } from './storage.js';

const require = createRequire(import.meta.url);
const { Ytdl, parsePlaylistId } = require('@distube/ytdl-core');

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
    .slice(0, 120);
}

// Format duration in seconds to HH:MM:SS or MM:SS
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

// Convert "01:30" or "01:15:30" string to seconds integer
export function timeStringToSeconds(str) {
  if (!str) return 0;
  if (typeof str === 'number') return str;
  const parts = str.trim().split(':').map(p => parseFloat(p) || 0);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return parseFloat(str) || 0;
}

// Convert seconds integer to standard HH:MM:SS string for FFmpeg
export function secondsToFfmpegTime(seconds) {
  const sec = Math.floor(seconds % 60);
  const min = Math.floor((seconds / 60) % 60);
  const hrs = Math.floor(seconds / 3600);
  return `${String(hrs).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
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

  // 3. Fallback to system PATH
  return 'ffmpeg';
}

/**
 * Convert WebVTT format to SubRip (SRT) format
 */
export function vttToSrt(vtt) {
  if (!vtt) return '';
  const cleaned = vtt
    .replace(/^WEBVTT[^\n]*\n+/i, '')
    .replace(/Kind:[^\n]*\n/gi, '')
    .replace(/Language:[^\n]*\n/gi, '')
    .replace(/Style:\n[\s\S]*?\n\n/g, '')
    .replace(/NOTE[^\n]*\n[\s\S]*?\n\n/g, '')
    .trim();

  const blocks = cleaned.split(/\n\s*\n/);
  const srtBlocks = [];
  let counter = 1;

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (!lines.length || !lines[0]) continue;
    const timeLineIdx = lines.findIndex(l => l.includes('-->'));
    if (timeLineIdx === -1) continue;

    let timeLine = lines[timeLineIdx];
    // Replace 00:00.000 or 00:00:00.000 to standard 00:00:00,000
    timeLine = timeLine.replace(/(\d{1,2}:)?(\d{2}:\d{2})\.(\d{3})/g, (m, hh, mmss, ms) => {
      const fullHh = hh ? hh.replace(':', '').padStart(2, '0') + ':' : '00:';
      return `${fullHh}${mmss},${ms}`;
    });

    const textLines = lines.slice(timeLineIdx + 1).map(l => l.replace(/<\/?[^>]+(>|$)/g, '').trim()).filter(Boolean);
    if (!textLines.length) continue;

    srtBlocks.push(`${counter++}\n${timeLine}\n${textLines.join('\n')}`);
  }

  return srtBlocks.join('\n\n') + '\n';
}

/**
 * Analyze YouTube video URL and return video info, qualities, audio languages, and subtitles
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

  // Put default/original audio at top
  audioLanguages.sort((a, b) => {
    if (a.isDefault || a.languageName.includes('Original') || a.languageName.includes('Default')) return -1;
    if (b.isDefault || b.languageName.includes('Original') || b.languageName.includes('Default')) return 1;
    return a.languageName.localeCompare(b.languageName);
  });

  // 3. Parse Subtitles / Captions
  const rawCaptions = info.captionTracks || [];
  const subtitles = rawCaptions.map(c => ({
    languageCode: c.languageCode,
    languageName: c.name?.simpleText || (typeof c.name === 'string' ? c.name : c.languageCode),
    isAutoGenerated: !!c.isAutoGenerated,
    isDefault: !!c.isDefault,
    url: c.url
  }));

  // 4. Extract Hashtags from title and description
  const fullDesc = videoDetails.description || '';
  const fullTitle = videoDetails.title || '';
  const rawHashtags = [
    ...(fullTitle.match(/#[^\s#]+/gi) || []),
    ...(fullDesc.match(/#[^\s#]+/gi) || [])
  ];
  const hashtags = Array.from(new Set(rawHashtags));

  // 5. SEO Tags / Keywords
  const keywords = Array.isArray(videoDetails.keywords) ? videoDetails.keywords : [];

  // 6. Channel & Author Information
  const author = {
    name: videoDetails.author?.name || 'Unknown Channel',
    channelUrl: videoDetails.author?.channel_url || videoDetails.author?.url || (videoDetails.author?.id ? `https://www.youtube.com/channel/${videoDetails.author.id}` : null),
    id: videoDetails.author?.id || null,
    verified: Boolean(videoDetails.author?.verified),
    subscriberCount: videoDetails.author?.subscriberCount || videoDetails.author?.subscriber_count || null,
    subscriberCountFormatted: videoDetails.author?.subscriberCount
      ? new Intl.NumberFormat('en', { notation: 'compact' }).format(videoDetails.author.subscriberCount)
      : null,
    avatar: videoDetails.author?.thumbnails?.[videoDetails.author.thumbnails.length - 1]?.url || null
  };

  // 7. Thumbnail resolutions
  const allThumbnails = (videoDetails.thumbnails || []).map(t => ({
    url: t.url,
    width: t.width,
    height: t.height,
    label: t.width >= 1280 ? 'HD (1280x720)' : t.width >= 640 ? 'Medium (640x480)' : `${t.width}x${t.height}`
  }));
  const maxThumbnail = videoDetails.thumbnails?.[videoDetails.thumbnails.length - 1]?.url || null;

  const actualId = videoDetails.id || videoDetails.videoId || (url.match(/(?:v=|youtu\.be\/)([\w-]{11})/)?.[1]) || '';
  const actualUrl = videoDetails.url || (actualId ? `https://www.youtube.com/watch?v=${actualId}` : url);

  return {
    id: actualId,
    webpageUrl: actualUrl,
    title: videoDetails.title,
    description: fullDesc,
    shortDescription: fullDesc.slice(0, 300),
    thumbnail: maxThumbnail,
    thumbnails: allThumbnails,
    duration: parseInt(videoDetails.lengthSeconds) || 0,
    durationFormatted: formatDuration(videoDetails.lengthSeconds),
    channel: author.name,
    channelUrl: author.channelUrl,
    author,
    category: videoDetails.category || 'General',
    keywords,
    hashtags,
    viewCount: parseInt(videoDetails.viewCount) || 0,
    viewCountFormatted: videoDetails.viewCount ? new Intl.NumberFormat('en', { notation: 'compact' }).format(videoDetails.viewCount) : '0',
    uploadDate: videoDetails.uploadDate || '',
    availableVideoQualities,
    audioLanguages,
    subtitles,
    hasSubtitles: subtitles.length > 0,
    hasMultipleAudioLanguages: audioLanguages.length > 1
  };
}

/**
 * Analyze YouTube Playlist URL
 */
export async function analyzePlaylist(playlistUrl) {
  const plId = parsePlaylistId(playlistUrl);
  if (!plId) {
    throw new Error('Invalid playlist URL. Please provide a valid YouTube playlist URL containing ?list=...');
  }

  const pl = await ytdl.getPlaylist(plId);
  const videos = (pl.videos || []).map(v => ({
    id: v.id,
    url: v.url || `https://www.youtube.com/watch?v=${v.id}`,
    title: v.title,
    duration: v.lengthSeconds || 0,
    durationFormatted: formatDuration(v.lengthSeconds),
    channel: v.author?.name || 'Unknown Channel',
    thumbnail: v.thumbnails?.[v.thumbnails.length - 1]?.url || null
  }));

  return {
    id: plId,
    title: pl.title || 'YouTube Playlist',
    url: playlistUrl,
    videoCount: videos.length,
    channel: pl.author?.name || 'Unknown Channel',
    thumbnail: videos[0]?.thumbnail || null,
    videos
  };
}

/**
 * Download Subtitle Track (SRT or VTT)
 */
export async function downloadSubtitle(url, { languageCode, format = 'srt', title, videoId }) {
  const safeTitle = sanitizeFileName(title || 'video');
  const safeId = videoId || (url.match(/(?:v=|youtu\.be\/)([\w-]{11})/)?.[1]) || 'sub';
  const prefix = getTimestampPrefix();
  const ext = format.toLowerCase() === 'vtt' ? 'vtt' : 'srt';
  const targetFileName = `${prefix}${safeTitle}_${languageCode}.${ext}`;
  const targetDir = getDownloadsDir(SUBFOLDERS.SUBTITLES);
  const targetFilePath = path.join(targetDir, targetFileName);

  const rawVtt = await ytdl.getCaptions(url, { lang: languageCode, format: 'vtt' });
  if (!rawVtt) {
    throw new Error(`No subtitles found for language: ${languageCode}`);
  }

  const finalContent = ext === 'srt' ? vttToSrt(rawVtt) : rawVtt;
  fs.writeFileSync(targetFilePath, finalContent, 'utf8');
  const stats = fs.statSync(targetFilePath);

  return {
    fileName: targetFileName,
    relativePath: `${SUBFOLDERS.SUBTITLES}/${targetFileName}`,
    filePath: targetFilePath,
    fileSize: stats.size,
    fileSizeFormatted: formatBytes(stats.size),
    category: SUBFOLDERS.SUBTITLES,
    format: ext
  };
}

/**
 * Resolve exact audio format based on language, track ID, and itag
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

  // 2. Match by audioLanguage
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
 * Clean up all temporary part and stream files associated with a jobId
 */
export function cleanupJobFiles(jobId) {
  try {
    const dDir = getDownloadsDir();
    if (!fs.existsSync(dDir)) return;
    const files = fs.readdirSync(dDir);
    for (const f of files) {
      if (f.includes(jobId)) {
        try { fs.unlinkSync(path.join(dDir, f)); } catch (e) {}
      }
    }
  } catch (e) {}
}

/**
 * Optimized Stream Downloader:
 * - Uses parallel multi-part Range downloads if fastDownload is enabled, format.url is present, and file size >= 10MB
 * - Otherwise falls back to highWaterMark/chunkSize tuned stream
 */
async function downloadFormatStream({
  ytdlInstance,
  url,
  format,
  destinationPath,
  abortController,
  fastDownload = true,
  onChunkProgress
}) {
  const total = format.contentLength ? parseInt(format.contentLength) : 0;
  const isChunkEligible = fastDownload && format.url && total >= 10 * 1024 * 1024; // >= 10 MB

  if (isChunkEligible) {
    const numChunks = Math.min(4, Math.max(2, Math.floor(total / (10 * 1024 * 1024))));
    const chunkSize = Math.ceil(total / numChunks);
    const chunks = [];
    const tempPartFiles = [];

    for (let i = 0; i < numChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(total - 1, (i + 1) * chunkSize - 1);
      const partPath = path.join(path.dirname(destinationPath), `temp_part_${path.basename(destinationPath)}_${i}.tmp`);
      tempPartFiles.push(partPath);
      chunks.push({ index: i, start, end, partPath, downloaded: 0, total: end - start + 1 });
    }

    try {
      await Promise.all(chunks.map(async (c) => {
        const fetchCtrl = new AbortController();
        if (abortController.fetchControllers) {
          abortController.fetchControllers.push(fetchCtrl);
        }

        const res = await fetch(format.url, {
          signal: fetchCtrl.signal,
          headers: {
            'Range': `bytes=${c.start}-${c.end}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        if (!res.ok && res.status !== 206) {
          throw new Error(`Chunk ${c.index} range request failed with status ${res.status}`);
        }

        const writeStream = fs.createWriteStream(c.partPath);
        for await (const chunk of res.body) {
          if (abortController.aborted) {
            writeStream.destroy();
            throw new Error('Download aborted');
          }
          writeStream.write(Buffer.from(chunk));
          c.downloaded += chunk.length;
          const currentTotalDownloaded = chunks.reduce((acc, curr) => acc + curr.downloaded, 0);
          if (onChunkProgress) {
            onChunkProgress(currentTotalDownloaded, total);
          }
        }
        await new Promise((resFinish, rejFinish) => {
          writeStream.end(() => resFinish());
          writeStream.on('error', rejFinish);
        });
      }));

      if (abortController.aborted) throw new Error('Download aborted');

      // Stitch chunks sequentially into destinationPath
      const finalWriteStream = fs.createWriteStream(destinationPath);
      for (const c of chunks) {
        if (fs.existsSync(c.partPath)) {
          await new Promise((resPipe, rejPipe) => {
            const rs = fs.createReadStream(c.partPath);
            rs.pipe(finalWriteStream, { end: false });
            rs.on('end', () => {
              try { fs.unlinkSync(c.partPath); } catch (e) {}
              resPipe();
            });
            rs.on('error', rejPipe);
          });
        }
      }
      await new Promise(r => finalWriteStream.end(r));
      return total;
    } catch (err) {
      for (const p of tempPartFiles) {
        try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (e) {}
      }
      if (abortController.aborted) throw err;
      console.warn('Multi-chunk range download failed, falling back to standard stream:', err.message);
    }
  }

  // Fallback / Standard stream with highWaterMark buffer optimization
  const stream = await ytdlInstance.download(url, {
    format,
    highWaterMark: 1024 * 1024 * 10,
    chunkSize: 1024 * 1024 * 10
  });
  abortController.streams.push(stream);

  const writeStream = fs.createWriteStream(destinationPath);
  let downloaded = 0;

  return new Promise((resolve, reject) => {
    stream.on('data', chunk => {
      if (abortController.aborted) return;
      downloaded += chunk.length;
      writeStream.write(chunk);
      if (onChunkProgress) {
        onChunkProgress(downloaded, total);
      }
    });
    stream.on('end', () => {
      writeStream.end();
      resolve(downloaded);
    });
    stream.on('error', err => {
      writeStream.end();
      reject(err);
    });
  });
}

/**
 * Execute download based on selection (supports trimming, subfolders, fast multi-threaded chunks, and timestamp prefix)
 */
export async function executeDownload(jobId, options, callbacks) {
  const {
    url,
    mode,
    videoItag,
    audioItag,
    audioLanguage,
    audioTrackId,
    container = 'mp4',
    trimStart,
    trimEnd,
    subfolderOverride,
    fastDownload = true
  } = options;
  const { onProgress, onComplete, onError } = callbacks;

  const isTrimmed = Boolean((trimStart && trimStart !== '0' && trimStart !== '0:00' && trimStart !== '00:00') || trimEnd);
  const trimStartSec = timeStringToSeconds(trimStart);
  const trimEndSec = trimEnd ? timeStringToSeconds(trimEnd) : null;

  // Determine subfolder destination
  let subfolder = subfolderOverride;
  if (!subfolder) {
    if (isTrimmed) {
      subfolder = SUBFOLDERS.CLIPS;
    } else if (mode === 'audio_only') {
      subfolder = SUBFOLDERS.AUDIO;
    } else {
      subfolder = SUBFOLDERS.VIDEOS;
    }
  }

  const destinationDir = getDownloadsDir(subfolder);
  const timestampPrefix = getTimestampPrefix();

  try {
    const info = await ytdl.getInfo(url);
    const safeTitle = sanitizeFileName(info.videoDetails?.title || 'video');
    const videoId = info.videoDetails?.videoId || info.videoDetails?.id || (url.match(/(?:v=|youtu\.be\/)([\w-]{11})/)?.[1]) || 'video';

    // Optional clipping label in filename
    const safeTrimStart = (trimStart || '00-00').replace(/:/g, '-');
    const safeTrimEnd = (trimEnd || formatDuration(info.videoDetails.lengthSeconds)).replace(/:/g, '-');
    const clipTag = isTrimmed ? ` [Clip ${safeTrimStart} to ${safeTrimEnd}]` : '';

    let targetFileName = '';
    let targetFilePath = '';

    const abortController = {
      aborted: false,
      streams: [],
      fetchControllers: [],
      ffmpegProc: null
    };
    activeJobs.set(jobId, abortController);

    // =========================================================
    // MODE 1: Audio Only
    // =========================================================
    if (mode === 'audio_only') {
      const audioFormat = resolveAudioFormat(info.formats, { audioTrackId, audioLanguage, audioItag });
      const langLabel = audioFormat.audioTrack?.displayName || audioLanguage;
      const langTag = langLabel && !langLabel.includes('Original') && !langLabel.includes('Default') ? ` [${sanitizeFileName(langLabel)}]` : '';

      const ext = container === 'mp3' ? 'mp3' : (audioFormat.container || 'm4a');
      targetFileName = `${timestampPrefix}${safeTitle} [Audio${langTag}]${clipTag} [${videoId}].${ext}`;
      targetFilePath = path.join(destinationDir, targetFileName);

      const needsFfmpegAudio = isTrimmed || (ext === 'mp3' && audioFormat.container !== 'mp3');
      const streamDownloadPath = needsFfmpegAudio ? path.join(getDownloadsDir(), `temp_${jobId}_rawaudio.${audioFormat.container || 'm4a'}`) : targetFilePath;

      const total = audioFormat.contentLength ? parseInt(audioFormat.contentLength) : 0;
      let startTime = Date.now();
      let lastReport = Date.now();

      await downloadFormatStream({
        ytdlInstance: ytdl,
        url,
        format: audioFormat,
        destinationPath: streamDownloadPath,
        abortController,
        fastDownload,
        onChunkProgress: (downloaded, totalBytes) => {
          const now = Date.now();
          if (now - lastReport >= 250) {
            const elapsedSec = (now - startTime) / 1000;
            const speedBytesPerSec = downloaded / (elapsedSec || 1);
            const percent = totalBytes ? Math.min(needsFfmpegAudio ? 80 : 99, Math.round((downloaded / totalBytes) * (needsFfmpegAudio ? 80 : 100))) : 50;
            const etaSec = totalBytes ? Math.round((totalBytes - downloaded) / (speedBytesPerSec || 1)) : 0;

            onProgress({
              percent: `${percent}%`,
              speed: `${formatBytes(speedBytesPerSec)}/s`,
              eta: totalBytes ? `${etaSec}s` : '--',
              totalSize: totalBytes ? formatBytes(totalBytes) : formatBytes(downloaded),
              status: 'downloading',
              fastDownload,
              message: fastDownload
                ? `⚡ Turbo downloading audio (${langLabel || 'Original'})...`
                : `Downloading audio (${langLabel || 'Original'})...`
            });
            lastReport = now;
          }
        }
      });

      if (abortController.aborted) return;

      if (needsFfmpegAudio) {
        onProgress({
          percent: '85%',
          speed: '--',
          eta: '--',
          totalSize: formatBytes(total),
          status: 'merging',
          message: isTrimmed ? 'Trimming audio clip...' : 'Converting audio to MP3...'
        });

        const ffmpegArgs = [];
        if (trimStartSec > 0) {
          ffmpegArgs.push('-ss', secondsToFfmpegTime(trimStartSec));
        }
        if (trimEndSec && trimEndSec > trimStartSec) {
          ffmpegArgs.push('-t', String(trimEndSec - trimStartSec));
        }
        ffmpegArgs.push('-i', streamDownloadPath);
        if (ext === 'mp3') {
          ffmpegArgs.push('-c:a', 'libmp3lame', '-b:a', '192k');
        } else {
          ffmpegArgs.push('-c:a', 'copy');
        }
        ffmpegArgs.push('-y', targetFilePath);

        const ffmpegProc = spawn(getFfmpegPath(), ffmpegArgs, { windowsHide: true });
        abortController.ffmpegProc = ffmpegProc;

        ffmpegProc.on('close', code => {
          try { if (fs.existsSync(streamDownloadPath)) fs.unlinkSync(streamDownloadPath); } catch (e) {}
          cleanupJobFiles(jobId);
          activeJobs.delete(jobId);

          if (code === 0 && fs.existsSync(targetFilePath)) {
            const finalSize = fs.statSync(targetFilePath).size;
            onComplete({
              jobId,
              fileName: targetFileName,
              relativePath: `${subfolder}/${targetFileName}`,
              filePath: targetFilePath,
              fileSize: finalSize,
              fileSizeFormatted: formatBytes(finalSize),
              status: 'completed'
            });
          } else {
            onError(new Error(`Audio processing failed with exit code ${code}`));
          }
        });

        ffmpegProc.on('error', err => {
          try { if (fs.existsSync(streamDownloadPath)) fs.unlinkSync(streamDownloadPath); } catch (e) {}
          cleanupJobFiles(jobId);
          activeJobs.delete(jobId);
          onError(err);
        });

      } else {
        cleanupJobFiles(jobId);
        activeJobs.delete(jobId);
        const finalSize = fs.existsSync(targetFilePath) ? fs.statSync(targetFilePath).size : total;
        onComplete({
          jobId,
          fileName: targetFileName,
          relativePath: `${subfolder}/${targetFileName}`,
          filePath: targetFilePath,
          fileSize: finalSize,
          fileSizeFormatted: formatBytes(finalSize),
          status: 'completed'
        });
      }
      return;
    }

    // =========================================================
    // MODE 2: Video Only
    // =========================================================
    if (mode === 'video_only') {
      const selectedVideoItag = parseInt(videoItag);
      const videoFormat = info.formats.find(f => f.itag === selectedVideoItag) || 
                          info.formats.filter(f => f.hasVideo).sort((a, b) => (b.height || 0) - (a.height || 0))[0];

      const ext = videoFormat.container || 'mp4';
      targetFileName = `${timestampPrefix}${safeTitle} [Video Only]${clipTag} [${videoId}].${ext}`;
      targetFilePath = path.join(destinationDir, targetFileName);

      const streamDownloadPath = isTrimmed ? path.join(getDownloadsDir(), `temp_${jobId}_rawvideo.${ext}`) : targetFilePath;

      const total = videoFormat.contentLength ? parseInt(videoFormat.contentLength) : 0;
      let startTime = Date.now();
      let lastReport = Date.now();

      await downloadFormatStream({
        ytdlInstance: ytdl,
        url,
        format: videoFormat,
        destinationPath: streamDownloadPath,
        abortController,
        fastDownload,
        onChunkProgress: (downloaded, totalBytes) => {
          const now = Date.now();
          if (now - lastReport >= 250) {
            const elapsedSec = (now - startTime) / 1000;
            const speedBytesPerSec = downloaded / (elapsedSec || 1);
            const percent = totalBytes ? Math.min(isTrimmed ? 80 : 99, Math.round((downloaded / totalBytes) * (isTrimmed ? 80 : 100))) : 50;
            const etaSec = totalBytes ? Math.round((totalBytes - downloaded) / (speedBytesPerSec || 1)) : 0;

            onProgress({
              percent: `${percent}%`,
              speed: `${formatBytes(speedBytesPerSec)}/s`,
              eta: totalBytes ? `${etaSec}s` : '--',
              totalSize: totalBytes ? formatBytes(totalBytes) : formatBytes(downloaded),
              status: 'downloading',
              fastDownload,
              message: fastDownload
                ? `⚡ Turbo downloading video chunks (${videoFormat.qualityLabel || 'HD'})...`
                : `Downloading video stream (${videoFormat.qualityLabel || 'HD'})...`
            });
            lastReport = now;
          }
        }
      });

      if (abortController.aborted) return;

      if (isTrimmed) {
        onProgress({
          percent: '85%',
          speed: '--',
          eta: '--',
          totalSize: formatBytes(total),
          status: 'merging',
          message: 'Trimming video clip...'
        });

        const ffmpegArgs = [];
        if (trimStartSec > 0) {
          ffmpegArgs.push('-ss', secondsToFfmpegTime(trimStartSec));
        }
        if (trimEndSec && trimEndSec > trimStartSec) {
          ffmpegArgs.push('-t', String(trimEndSec - trimStartSec));
        }
        ffmpegArgs.push('-i', streamDownloadPath, '-c:v', 'copy', '-y', targetFilePath);

        const ffmpegProc = spawn(getFfmpegPath(), ffmpegArgs, { windowsHide: true });
        abortController.ffmpegProc = ffmpegProc;

        ffmpegProc.on('close', code => {
          try { if (fs.existsSync(streamDownloadPath)) fs.unlinkSync(streamDownloadPath); } catch (e) {}
          cleanupJobFiles(jobId);
          activeJobs.delete(jobId);

          if (code === 0 && fs.existsSync(targetFilePath)) {
            const finalSize = fs.statSync(targetFilePath).size;
            onComplete({
              jobId,
              fileName: targetFileName,
              relativePath: `${subfolder}/${targetFileName}`,
              filePath: targetFilePath,
              fileSize: finalSize,
              fileSizeFormatted: formatBytes(finalSize),
              status: 'completed'
            });
          } else {
            onError(new Error(`Video trimming failed with exit code ${code}`));
          }
        });

        ffmpegProc.on('error', err => {
          try { if (fs.existsSync(streamDownloadPath)) fs.unlinkSync(streamDownloadPath); } catch (e) {}
          cleanupJobFiles(jobId);
          activeJobs.delete(jobId);
          onError(err);
        });

      } else {
        cleanupJobFiles(jobId);
        activeJobs.delete(jobId);
        const finalSize = fs.existsSync(targetFilePath) ? fs.statSync(targetFilePath).size : total;
        onComplete({
          jobId,
          fileName: targetFileName,
          relativePath: `${subfolder}/${targetFileName}`,
          filePath: targetFilePath,
          fileSize: finalSize,
          fileSizeFormatted: formatBytes(finalSize),
          status: 'completed'
        });
      }
      return;
    }

    // =========================================================
    // MODE 3: Both (Video + Audio)
    // =========================================================
    const selectedVideoItag = parseInt(videoItag);
    const audioFormat = resolveAudioFormat(info.formats, { audioTrackId, audioLanguage, audioItag });

    const videoFormat = info.formats.find(f => f.itag === selectedVideoItag) || 
                        info.formats.filter(f => f.hasVideo).sort((a, b) => (b.height || 0) - (a.height || 0))[0];

    const isCustomLanguage = audioLanguage && !audioLanguage.includes('Original') && !audioLanguage.includes('Default');

    // Single stream progressive video download (when progressive format with audio exists and no trim/custom audio)
    if (videoFormat && videoFormat.hasAudio && !isCustomLanguage && !isTrimmed && (!audioItag || videoFormat.itag === audioFormat.itag)) {
      const ext = videoFormat.container || 'mp4';
      targetFileName = `${timestampPrefix}${safeTitle} [${videoId}].${ext}`;
      targetFilePath = path.join(destinationDir, targetFileName);

      const total = videoFormat.contentLength ? parseInt(videoFormat.contentLength) : 0;
      let startTime = Date.now();
      let lastReport = Date.now();

      await downloadFormatStream({
        ytdlInstance: ytdl,
        url,
        format: videoFormat,
        destinationPath: targetFilePath,
        abortController,
        fastDownload,
        onChunkProgress: (downloaded, totalBytes) => {
          const now = Date.now();
          if (now - lastReport >= 250) {
            const elapsedSec = (now - startTime) / 1000;
            const speedBytesPerSec = downloaded / (elapsedSec || 1);
            const percent = totalBytes ? Math.min(99, Math.round((downloaded / totalBytes) * 100)) : 50;
            const etaSec = totalBytes ? Math.round((totalBytes - downloaded) / (speedBytesPerSec || 1)) : 0;

            onProgress({
              percent: `${percent}%`,
              speed: `${formatBytes(speedBytesPerSec)}/s`,
              eta: totalBytes ? `${etaSec}s` : '--',
              totalSize: totalBytes ? formatBytes(totalBytes) : formatBytes(downloaded),
              status: 'downloading',
              fastDownload,
              message: fastDownload
                ? `⚡ Turbo downloading combined video stream...`
                : `Downloading video & audio stream...`
            });
            lastReport = now;
          }
        }
      });

      if (abortController.aborted) return;
      cleanupJobFiles(jobId);
      activeJobs.delete(jobId);
      const finalSize = fs.existsSync(targetFilePath) ? fs.statSync(targetFilePath).size : total;
      onComplete({
        jobId,
        fileName: targetFileName,
        relativePath: `${subfolder}/${targetFileName}`,
        filePath: targetFilePath,
        fileSize: finalSize,
        fileSizeFormatted: formatBytes(finalSize),
        status: 'completed'
      });
      return;
    }

    // Separate Video + Audio: Download Video & Audio IN PARALLEL!
    const langLabel = audioFormat?.audioTrack?.displayName || audioLanguage;
    const langTag = langLabel && !langLabel.includes('Original') && !langLabel.includes('Default') ? ` [${sanitizeFileName(langLabel)}]` : '';

    const ext = container || 'mp4';
    targetFileName = `${timestampPrefix}${safeTitle}${langTag}${clipTag} [${videoId}].${ext}`;
    targetFilePath = path.join(destinationDir, targetFileName);

    const tempDir = getDownloadsDir();
    const tempVideoPath = path.join(tempDir, `temp_${jobId}_video.mp4`);
    const tempAudioPath = path.join(tempDir, `temp_${jobId}_audio.m4a`);

    let vDownloaded = 0;
    let aDownloaded = 0;
    const vTotal = videoFormat.contentLength ? parseInt(videoFormat.contentLength) : 0;
    const aTotal = audioFormat.contentLength ? parseInt(audioFormat.contentLength) : 0;
    const grandTotal = vTotal + aTotal;
    let startTime = Date.now();
    let lastReport = Date.now();

    const reportBothProgress = () => {
      const now = Date.now();
      if (now - lastReport < 250) return;
      lastReport = now;

      const totalDown = vDownloaded + aDownloaded;
      const elapsedSec = (now - startTime) / 1000;
      const speedBytesPerSec = totalDown / (elapsedSec || 1);
      const percent = grandTotal ? Math.min(88, Math.round((totalDown / grandTotal) * 88)) : 45;
      const etaSec = grandTotal ? Math.round((grandTotal - totalDown) / (speedBytesPerSec || 1)) : 0;

      onProgress({
        percent: `${percent}%`,
        speed: `${formatBytes(speedBytesPerSec)}/s`,
        eta: grandTotal ? `${etaSec}s` : '--',
        totalSize: grandTotal ? formatBytes(grandTotal) : formatBytes(totalDown),
        status: 'downloading',
        fastDownload,
        message: fastDownload
          ? `⚡ Turbo downloading Video (${videoFormat.qualityLabel || 'HD'}) & Audio in parallel chunks...`
          : `Downloading Video (${videoFormat.qualityLabel || 'HD'}) & Audio streams...`
      });
    };

    onProgress({
      percent: '5%',
      speed: '--',
      eta: '--',
      totalSize: grandTotal ? formatBytes(grandTotal) : 'Calculating...',
      status: 'downloading',
      fastDownload,
      message: fastDownload
        ? `⚡ Initializing multi-threaded parallel streams for Video & Audio...`
        : `Initializing video & audio download streams...`
    });

    // Execute Video & Audio downloads simultaneously in parallel!
    await Promise.all([
      downloadFormatStream({
        ytdlInstance: ytdl,
        url,
        format: videoFormat,
        destinationPath: tempVideoPath,
        abortController,
        fastDownload,
        onChunkProgress: (down, tot) => {
          vDownloaded = down;
          reportBothProgress();
        }
      }),
      downloadFormatStream({
        ytdlInstance: ytdl,
        url,
        format: audioFormat,
        destinationPath: tempAudioPath,
        abortController,
        fastDownload,
        onChunkProgress: (down, tot) => {
          aDownloaded = down;
          reportBothProgress();
        }
      })
    ]);

    if (abortController.aborted) return;

    // Merge video & audio (with optional trimming) using FFmpeg
    onProgress({
      percent: '92%',
      speed: '--',
      eta: '--',
      totalSize: formatBytes(vDownloaded + aDownloaded),
      status: 'merging',
      message: isTrimmed ? 'Trimming and merging video & audio with FFmpeg...' : 'Merging video and audio into final MP4 with FFmpeg...'
    });

    const ffmpegPath = getFfmpegPath();
    const ffmpegArgs = [];

    const clipDurationSec = (trimEndSec && trimEndSec > trimStartSec) ? (trimEndSec - trimStartSec) : null;
    if (isTrimmed) {
      if (trimStartSec > 0) {
        ffmpegArgs.push('-ss', secondsToFfmpegTime(trimStartSec));
      }
      if (clipDurationSec) {
        ffmpegArgs.push('-t', String(clipDurationSec));
      }
    }

    ffmpegArgs.push('-i', tempVideoPath);

    if (isTrimmed) {
      if (trimStartSec > 0) {
        ffmpegArgs.push('-ss', secondsToFfmpegTime(trimStartSec));
      }
      if (clipDurationSec) {
        ffmpegArgs.push('-t', String(clipDurationSec));
      }
    }

    ffmpegArgs.push(
      '-i', tempAudioPath,
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-map', '0:v:0',
      '-map', '1:a:0',
      '-shortest',
      '-y',
      targetFilePath
    );

    const ffmpegProc = spawn(ffmpegPath, ffmpegArgs, { windowsHide: true });
    abortController.ffmpegProc = ffmpegProc;

    let ffmpegErr = '';
    ffmpegProc.stderr.on('data', d => { ffmpegErr += d.toString(); });

    ffmpegProc.on('close', code => {
      try { if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath); } catch (e) {}
      try { if (fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath); } catch (e) {}
      cleanupJobFiles(jobId);
      activeJobs.delete(jobId);

      if (code === 0 && fs.existsSync(targetFilePath)) {
        const finalSize = fs.statSync(targetFilePath).size;
        onComplete({
          jobId,
          fileName: targetFileName,
          relativePath: `${subfolder}/${targetFileName}`,
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
      cleanupJobFiles(jobId);
      activeJobs.delete(jobId);
      onError(err);
    });

  } catch (err) {
    cleanupJobFiles(jobId);
    activeJobs.delete(jobId);
    onError(err);
  }
}

export function cancelJob(jobId) {
  const job = activeJobs.get(jobId);
  if (job) {
    job.aborted = true;
    if (job.fetchControllers) {
      for (const fc of job.fetchControllers) {
        try { fc.abort(); } catch (e) {}
      }
    }
    if (job.streams) {
      for (const s of job.streams) {
        try { s.destroy(); } catch (e) {}
      }
    }
    if (job.ffmpegProc) {
      try { job.ffmpegProc.kill(); } catch (e) {}
    }
    cleanupJobFiles(jobId);
    activeJobs.delete(jobId);
    return { success: true };
  }
  return { success: false, error: 'Job not found' };
}
