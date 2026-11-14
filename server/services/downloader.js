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
 * Execute download based on selection (supports trimming, subfolders, and timestamp prefix)
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
    subfolderOverride
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

    // Optional clipping label in filename (replace colons with hyphens for safe filesystem naming)
    const safeTrimStart = (trimStart || '00-00').replace(/:/g, '-');
    const safeTrimEnd = (trimEnd || formatDuration(info.videoDetails.lengthSeconds)).replace(/:/g, '-');
    const clipTag = isTrimmed ? ` [Clip ${safeTrimStart} to ${safeTrimEnd}]` : '';

    let targetFileName = '';
    let targetFilePath = '';

    const abortController = {
      aborted: false,
      streams: [],
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

      // If trimmed or MP3 container requested with different codec, use ffmpeg
      const needsFfmpegAudio = isTrimmed || (ext === 'mp3' && audioFormat.container !== 'mp3');
      const streamDownloadPath = needsFfmpegAudio ? path.join(getDownloadsDir(), `temp_${jobId}_rawaudio.${audioFormat.container || 'm4a'}`) : targetFilePath;

      const stream = await ytdl.download(url, { format: audioFormat });
      abortController.streams.push(stream);

      const writeStream = fs.createWriteStream(streamDownloadPath);
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
          const percent = total ? Math.min(needsFfmpegAudio ? 80 : 99, Math.round((downloaded / total) * (needsFfmpegAudio ? 80 : 100))) : 50;
          const etaSec = total ? Math.round((total - downloaded) / (speedBytesPerSec || 1)) : 0;

          onProgress({
            percent: `${percent}%`,
            speed: `${formatBytes(speedBytesPerSec)}/s`,
            eta: total ? `${etaSec}s` : '--',
            totalSize: total ? formatBytes(total) : formatBytes(downloaded),
            status: 'downloading',
            message: `Downloading audio (${langLabel || 'Original'})...`
          });
          lastReport = now;
        }
      });

      stream.on('end', () => {
        writeStream.end();
        if (abortController.aborted) return;

        if (needsFfmpegAudio) {
          onProgress({
            percent: '85%',
            speed: '--',
            eta: '--',
            totalSize: formatBytes(downloaded),
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
            activeJobs.delete(jobId);
            onError(err);
          });

        } else {
          activeJobs.delete(jobId);
          const finalSize = fs.existsSync(targetFilePath) ? fs.statSync(targetFilePath).size : downloaded;
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
      });

      stream.on('error', err => {
        writeStream.end();
        try { if (fs.existsSync(streamDownloadPath)) fs.unlinkSync(streamDownloadPath); } catch (e) {}
        activeJobs.delete(jobId);
        onError(err);
      });

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

      const stream = await ytdl.download(url, { format: videoFormat });
      abortController.streams.push(stream);

      const writeStream = fs.createWriteStream(streamDownloadPath);
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
          const percent = total ? Math.min(isTrimmed ? 80 : 99, Math.round((downloaded / total) * (isTrimmed ? 80 : 100))) : 50;
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
        if (abortController.aborted) return;

        if (isTrimmed) {
          onProgress({
            percent: '85%',
            speed: '--',
            eta: '--',
            totalSize: formatBytes(downloaded),
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
            activeJobs.delete(jobId);
            onError(err);
          });

        } else {
          activeJobs.delete(jobId);
          const finalSize = fs.existsSync(targetFilePath) ? fs.statSync(targetFilePath).size : downloaded;
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
      });

      stream.on('error', err => {
        writeStream.end();
        try { if (fs.existsSync(streamDownloadPath)) fs.unlinkSync(streamDownloadPath); } catch (e) {}
        activeJobs.delete(jobId);
        onError(err);
      });

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

    // Single stream progressive video download (when no trimming and original audio)
    if (videoFormat && videoFormat.hasAudio && !isCustomLanguage && !isTrimmed && (!audioItag || videoFormat.itag === audioFormat.itag)) {
      const ext = videoFormat.container || 'mp4';
      targetFileName = `${timestampPrefix}${safeTitle} [${videoId}].${ext}`;
      targetFilePath = path.join(destinationDir, targetFileName);

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
          relativePath: `${subfolder}/${targetFileName}`,
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

    // Separate Video + Audio (or trimmed single stream): Mux / Trim with FFmpeg
    const langLabel = audioFormat?.audioTrack?.displayName || audioLanguage;
    const langTag = langLabel && !langLabel.includes('Original') && !langLabel.includes('Default') ? ` [${sanitizeFileName(langLabel)}]` : '';

    const ext = container || 'mp4';
    targetFileName = `${timestampPrefix}${safeTitle}${langTag}${clipTag} [${videoId}].${ext}`;
    targetFilePath = path.join(destinationDir, targetFileName);

    const tempDir = getDownloadsDir();
    const tempVideoPath = path.join(tempDir, `temp_${jobId}_video.mp4`);
    const tempAudioPath = path.join(tempDir, `temp_${jobId}_audio.m4a`);

    // Download video stream
    onProgress({
      percent: '10%',
      speed: '--',
      eta: '--',
      totalSize: 'Calculating...',
      status: 'downloading',
      message: `Downloading video stream (${videoFormat.qualityLabel || 'HD'})...`
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

    // Download audio stream
    onProgress({
      percent: '70%',
      speed: '--',
      eta: '--',
      totalSize: 'Calculating...',
      status: 'downloading',
      message: `Downloading audio stream (${audioFormat.audioTrack?.displayName || 'Original'})...`
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
          const aPercent = aTotal ? 70 + Math.round((aDownloaded / aTotal) * 20) : 80;

          onProgress({
            percent: `${aPercent}%`,
            speed: `${formatBytes(speedBytesPerSec)}/s`,
            eta: '--',
            totalSize: aTotal ? formatBytes(aTotal) : formatBytes(aDownloaded),
            status: 'downloading',
            message: `Downloading audio (${audioFormat.audioTrack?.displayName || 'Original'})...`
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
