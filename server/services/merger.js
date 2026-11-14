import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { getDownloadsDir, formatBytes, getTimestampPrefix, SUBFOLDERS } from './storage.js';
import { getFfmpegPath, sanitizeFileName } from './downloader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

const activeMergeJobs = new Map();

/**
 * Resolve file path: handles relative paths within downloads/ or absolute paths
 */
export function resolveFilePath(givenPath) {
  if (!givenPath) return null;
  const downloadsDir = getDownloadsDir();

  // If already absolute and exists
  if (path.isAbsolute(givenPath) && fs.existsSync(givenPath)) {
    return givenPath;
  }

  // Check direct in downloads directory
  const direct = path.join(downloadsDir, givenPath);
  if (fs.existsSync(direct)) return direct;

  // Check in each subfolder
  for (const folder of Object.values(SUBFOLDERS)) {
    const candidate = path.join(downloadsDir, folder, path.basename(givenPath));
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}

/**
 * Convert FFmpeg time string "00:01:23.45" to total seconds
 */
function parseFfmpegTime(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(':');
  if (parts.length === 3) {
    return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
  }
  return 0;
}

/**
 * Execute FFmpeg Merge
 */
export async function executeMerge(jobId, options, callbacks) {
  const {
    videoPath,
    audioPath,
    subtitlePath,
    outputName,
    container = 'mp4',
    subtitleMode = 'soft' // 'soft' | 'burn'
  } = options;
  const { onProgress, onComplete, onError } = callbacks;

  const resolvedVideo = resolveFilePath(videoPath);
  const resolvedAudio = resolveFilePath(audioPath);
  const resolvedSubtitle = subtitlePath ? resolveFilePath(subtitlePath) : null;

  if (!resolvedVideo) {
    return onError(new Error(`Video file not found: ${videoPath}`));
  }
  if (!resolvedAudio) {
    return onError(new Error(`Audio file not found: ${audioPath}`));
  }
  if (subtitlePath && !resolvedSubtitle) {
    return onError(new Error(`Subtitle file not found: ${subtitlePath}`));
  }

  const timestampPrefix = getTimestampPrefix();
  const videoBaseName = path.basename(resolvedVideo, path.extname(resolvedVideo));
  const safeName = outputName
    ? sanitizeFileName(outputName).replace(/\.[^/.]+$/, '')
    : `merged_${videoBaseName}`;

  const ext = container.toLowerCase() === 'mkv' ? 'mkv' : 'mp4';
  const targetFileName = `${timestampPrefix}${safeName}.${ext}`;
  const targetDir = getDownloadsDir(SUBFOLDERS.MERGED);
  const targetFilePath = path.join(targetDir, targetFileName);

  const ffmpegPath = getFfmpegPath();
  const ffmpegArgs = [];

  // Input 0: Video
  ffmpegArgs.push('-i', resolvedVideo);
  // Input 1: Audio
  ffmpegArgs.push('-i', resolvedAudio);

  let hasSubtitles = Boolean(resolvedSubtitle);

  if (hasSubtitles) {
    if (subtitleMode === 'burn') {
      // Burn subtitles into video stream: requires video re-encoding
      // Escape Windows path backslashes and colons for ffmpeg subtitles filter
      const escapedSubPath = resolvedSubtitle.replace(/\\/g, '/').replace(/:/g, '\\:');
      ffmpegArgs.push(
        '-vf', `subtitles='${escapedSubPath}'`,
        '-map', '0:v:0',
        '-map', '1:a:0',
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '19',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-shortest',
        '-y',
        targetFilePath
      );
    } else {
      // Soft Subtitles (embedded track)
      ffmpegArgs.push('-i', resolvedSubtitle);

      if (ext === 'mkv') {
        ffmpegArgs.push(
          '-map', '0:v:0',
          '-map', '1:a:0',
          '-map', '2:s:0',
          '-c:v', 'copy',
          '-c:a', 'aac',
          '-c:s', 'srt',
          '-shortest',
          '-y',
          targetFilePath
        );
      } else {
        // MP4 container uses mov_text for subtitle stream
        ffmpegArgs.push(
          '-map', '0:v:0',
          '-map', '1:a:0',
          '-map', '2:s:0',
          '-c:v', 'copy',
          '-c:a', 'aac',
          '-c:s', 'mov_text',
          '-shortest',
          '-y',
          targetFilePath
        );
      }
    }
  } else {
    // Pure Video + Audio merge
    ffmpegArgs.push(
      '-map', '0:v:0',
      '-map', '1:a:0',
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-shortest',
      '-y',
      targetFilePath
    );
  }

  onProgress({
    percent: '15%',
    message: hasSubtitles && subtitleMode === 'burn'
      ? 'Burning subtitles and merging video & audio with FFmpeg...'
      : 'Merging video and audio streams into final container...'
  });

  const proc = spawn(ffmpegPath, ffmpegArgs, { windowsHide: true });
  activeMergeJobs.set(jobId, proc);

  let stderrOutput = '';
  let totalDurationSec = 0;

  proc.stderr.on('data', (data) => {
    const text = data.toString();
    stderrOutput += text;

    // Detect total duration from input header
    if (!totalDurationSec) {
      const durMatch = text.match(/Duration:\s*(\d{2}:\d{2}:\d{2}\.\d+)/);
      if (durMatch) {
        totalDurationSec = parseFfmpegTime(durMatch[1]);
      }
    }

    // Detect current processed time
    const timeMatch = text.match(/time=\s*(\d{2}:\d{2}:\d{2}\.\d+)/);
    if (timeMatch && totalDurationSec > 0) {
      const currentSec = parseFfmpegTime(timeMatch[1]);
      const rawPct = Math.min(98, Math.round((currentSec / totalDurationSec) * 100));
      const scaledPct = Math.max(20, rawPct);
      onProgress({
        percent: `${scaledPct}%`,
        message: `Merging streams... (${timeMatch[1]})`
      });
    }
  });

  proc.on('close', (code) => {
    activeMergeJobs.delete(jobId);

    if (code === 0 && fs.existsSync(targetFilePath)) {
      const stats = fs.statSync(targetFilePath);
      onComplete({
        jobId,
        fileName: targetFileName,
        relativePath: `${SUBFOLDERS.MERGED}/${targetFileName}`,
        filePath: targetFilePath,
        fileSize: stats.size,
        fileSizeFormatted: formatBytes(stats.size),
        status: 'completed'
      });
    } else {
      onError(new Error(stderrOutput.trim() || `FFmpeg merge failed with exit code ${code}`));
    }
  });

  proc.on('error', (err) => {
    activeMergeJobs.delete(jobId);
    onError(err);
  });
}

export function cancelMergeJob(jobId) {
  const proc = activeMergeJobs.get(jobId);
  if (proc) {
    try { proc.kill(); } catch (e) {}
    activeMergeJobs.delete(jobId);
    return { success: true };
  }
  return { success: false, error: 'Job not found' };
}
