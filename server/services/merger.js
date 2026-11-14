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
 * Convert standard #RRGGBB hex color to ASS format &HAABBGGRR&
 * In ASS format:
 *   Alpha 00 = 100% solid / opaque
 *   Alpha 80 = 50% semi-transparent
 *   Alpha FF = 0% fully transparent
 */
export function hexToAssColor(hex, opacityPercent = 100) {
  const clean = (hex || '#FFFFFF').replace('#', '');
  const r = clean.slice(0, 2).padStart(2, '0');
  const g = clean.slice(2, 4).padStart(2, '0');
  const b = clean.slice(4, 6).padStart(2, '0');
  const alphaVal = Math.round(((100 - Math.max(0, Math.min(100, opacityPercent))) / 100) * 255);
  const a = Math.max(0, Math.min(255, alphaVal)).toString(16).padStart(2, '0').toUpperCase();
  return `&H${a}${b}${g}${r}&`.toUpperCase();
}

/**
 * Build FFmpeg force_style string from subtitle styling options
 */
export function buildSubtitleForceStyle(style = {}) {
  const fontName = style.fontName || 'Arial';
  const fontSize = parseInt(style.fontSize) || 22;
  const primaryColor = hexToAssColor(style.textColor || '#FFFFFF', 100);
  
  // borderStyle: 3 = Opaque/semi-transparent background box, 1 = Outline with shadow
  const borderStyle = parseInt(style.borderStyle) || (style.bgStyle === 'box' ? 3 : 1);
  const backColor = hexToAssColor(style.bgColor || '#000000', style.bgOpacity ?? (borderStyle === 3 ? 60 : 0));
  const outline = style.outline !== undefined ? parseInt(style.outline) : (borderStyle === 3 ? 0 : 2);
  const outlineColor = hexToAssColor(style.outlineColor || '#000000', 100);
  const shadow = style.shadow !== undefined ? parseInt(style.shadow) : (borderStyle === 3 ? 0 : 1);
  const marginV = parseInt(style.marginV) || 25;
  const bold = style.bold ? 1 : 0;
  const italic = style.italic ? 1 : 0;

  const parts = [
    `FontName=${fontName}`,
    `FontSize=${fontSize}`,
    `PrimaryColour=${primaryColor}`,
    `BackColour=${backColor}`,
    `BorderStyle=${borderStyle}`,
    `Outline=${outline}`,
    `OutlineColour=${outlineColor}`,
    `Shadow=${shadow}`,
    `Alignment=2`,
    `MarginV=${marginV}`,
    `Bold=${bold}`,
    `Italic=${italic}`
  ];

  return parts.join(',');
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
 * Supports:
 * - Video + Audio
 * - Video + Subtitle (Audio optional)
 * - Video + Audio + Subtitle
 * - Custom Subtitle Styling (Font, Size, Color, Background Box, Outline, Margins)
 */
export async function executeMerge(jobId, options, callbacks) {
  const {
    videoPath,
    audioPath,
    subtitlePath,
    keepOriginalAudio = true,
    outputName,
    container = 'mp4',
    subtitleMode = 'soft', // 'soft' | 'burn'
    subtitleStyle = {}
  } = options;
  const { onProgress, onComplete, onError } = callbacks;

  const resolvedVideo = resolveFilePath(videoPath);
  const resolvedAudio = audioPath ? resolveFilePath(audioPath) : null;
  const resolvedSubtitle = subtitlePath ? resolveFilePath(subtitlePath) : null;

  if (!resolvedVideo) {
    return onError(new Error('Video file input is required'));
  }
  if (!resolvedAudio && !resolvedSubtitle) {
    return onError(new Error('Please select at least an Audio track or a Subtitle file to merge with the video'));
  }
  if (audioPath && !resolvedAudio) {
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

  let currentInputIndex = 1;
  let audioInputIndex = null;
  let subtitleInputIndex = null;

  // Input 1 (if audio supplied): Audio
  if (resolvedAudio) {
    ffmpegArgs.push('-i', resolvedAudio);
    audioInputIndex = currentInputIndex++;
  }

  // Input (if soft subtitle): Subtitle
  const hasSubtitles = Boolean(resolvedSubtitle);
  const isBurnIn = hasSubtitles && subtitleMode === 'burn';

  if (hasSubtitles && !isBurnIn) {
    ffmpegArgs.push('-i', resolvedSubtitle);
    subtitleInputIndex = currentInputIndex++;
  }

  // 1. Video Processing & Mapping
  if (isBurnIn) {
    // Escape Windows backslashes and colons for ffmpeg subtitles filter
    const escapedSubPath = resolvedSubtitle.replace(/\\/g, '/').replace(/:/g, '\\:');
    const forceStyle = buildSubtitleForceStyle(subtitleStyle);

    ffmpegArgs.push(
      '-vf', `subtitles='${escapedSubPath}':force_style='${forceStyle}'`,
      '-map', '0:v:0',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '19'
    );
  } else {
    ffmpegArgs.push(
      '-map', '0:v:0',
      '-c:v', 'copy'
    );
  }

  // 2. Audio Processing & Mapping
  if (resolvedAudio && audioInputIndex !== null) {
    // Map custom audio
    ffmpegArgs.push(
      '-map', `${audioInputIndex}:a:0`,
      '-c:a', 'aac',
      '-b:a', '192k'
    );
  } else if (keepOriginalAudio) {
    // Preserve original video audio (if present)
    ffmpegArgs.push(
      '-map', '0:a?',
      '-c:a', 'copy'
    );
  } else {
    // Mute
    ffmpegArgs.push('-an');
  }

  // 3. Subtitle Processing & Mapping (for Soft Subtitles)
  if (hasSubtitles && !isBurnIn && subtitleInputIndex !== null) {
    ffmpegArgs.push(
      '-map', `${subtitleInputIndex}:s:0`,
      '-c:s', ext === 'mkv' ? 'srt' : 'mov_text'
    );
  }

  ffmpegArgs.push('-shortest', '-y', targetFilePath);

  onProgress({
    percent: '15%',
    message: isBurnIn
      ? 'Burning styled subtitles onto video with FFmpeg...'
      : 'Merging media streams into container...'
  });

  const proc = spawn(ffmpegPath, ffmpegArgs, { windowsHide: true });
  activeMergeJobs.set(jobId, proc);

  let stderrOutput = '';
  let totalDurationSec = 0;

  proc.stderr.on('data', (data) => {
    const text = data.toString();
    stderrOutput += text;

    if (!totalDurationSec) {
      const durMatch = text.match(/Duration:\s*(\d{2}:\d{2}:\d{2}\.\d+)/);
      if (durMatch) {
        totalDurationSec = parseFfmpegTime(durMatch[1]);
      }
    }

    const timeMatch = text.match(/time=\s*(\d{2}:\d{2}:\d{2}\.\d+)/);
    if (timeMatch && totalDurationSec > 0) {
      const currentSec = parseFfmpegTime(timeMatch[1]);
      const rawPct = Math.min(98, Math.round((currentSec / totalDurationSec) * 100));
      const scaledPct = Math.max(20, rawPct);
      onProgress({
        percent: `${scaledPct}%`,
        message: isBurnIn
          ? `Burning subtitles... (${timeMatch[1]})`
          : `Merging streams... (${timeMatch[1]})`
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
