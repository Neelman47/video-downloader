import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec, spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');
const downloadsDir = path.join(rootDir, 'downloads');

// Subfolders for organized media storage
export const SUBFOLDERS = {
  VIDEOS: 'videos',
  AUDIO: 'audio',
  SUBTITLES: 'subtitles',
  CLIPS: 'clips',
  PLAYLISTS: 'playlists'
};

// Ensure downloads directory and subdirectories exist
export function initStorage() {
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
  }
  for (const folder of Object.values(SUBFOLDERS)) {
    const subPath = path.join(downloadsDir, folder);
    if (!fs.existsSync(subPath)) {
      fs.mkdirSync(subPath, { recursive: true });
    }
    const gitkeep = path.join(subPath, '.gitkeep');
    if (!fs.existsSync(gitkeep)) {
      try { fs.writeFileSync(gitkeep, ''); } catch (e) {}
    }
  }
}

initStorage();

export function getDownloadsDir(subfolder = '') {
  if (subfolder) {
    const target = path.join(downloadsDir, subfolder);
    if (!fs.existsSync(target)) {
      fs.mkdirSync(target, { recursive: true });
    }
    return target;
  }
  return downloadsDir;
}

/**
 * Generates timestamp prefix: YYYYMMDD_HHMM_
 */
export function getTimestampPrefix() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${yyyy}${mm}${dd}_${hh}${min}_`;
}

/**
 * Format bytes into human readable string
 */
export function formatBytes(bytes, decimals = 2) {
  if (!+bytes) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Recursively list all downloaded files across subdirectories
 */
export function listDownloadedFiles() {
  try {
    initStorage();
    const files = [];

    function scanDir(currentDir, relativeDir = '') {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        const relPath = relativeDir ? path.join(relativeDir, entry.name).replace(/\\/g, '/') : entry.name;

        if (entry.isDirectory()) {
          scanDir(fullPath, relPath);
        } else if (entry.isFile()) {
          // Skip temporary/internal files
          if (entry.name.endsWith('.part') || entry.name.endsWith('.ytdl') || entry.name === '.gitkeep') {
            continue;
          }

          const stats = fs.statSync(fullPath);
          const ext = path.extname(entry.name).toLowerCase();
          
          let type = 'unknown';
          let category = 'other';

          // Determine category and media type
          if (['.mp4', '.mkv', '.webm', '.avi', '.mov'].includes(ext)) {
            type = 'video';
          } else if (['.mp3', '.m4a', '.wav', '.opus', '.aac', '.flac'].includes(ext)) {
            type = 'audio';
          } else if (['.srt', '.vtt', '.sub', '.ass'].includes(ext)) {
            type = 'subtitle';
          }

          if (relativeDir.startsWith(SUBFOLDERS.CLIPS)) {
            category = 'clips';
          } else if (relativeDir.startsWith(SUBFOLDERS.PLAYLISTS)) {
            category = 'playlists';
          } else if (relativeDir.startsWith(SUBFOLDERS.SUBTITLES) || type === 'subtitle') {
            category = 'subtitles';
          } else if (relativeDir.startsWith(SUBFOLDERS.AUDIO) || type === 'audio') {
            category = 'audio';
          } else if (relativeDir.startsWith(SUBFOLDERS.VIDEOS) || type === 'video') {
            category = 'videos';
          }

          files.push({
            name: entry.name,
            relativePath: relPath,
            path: fullPath,
            size: stats.size,
            sizeFormatted: formatBytes(stats.size),
            createdAt: stats.birthtime || stats.ctime,
            modifiedAt: stats.mtime,
            extension: ext.replace('.', ''),
            type,
            category,
            folder: relativeDir || 'root'
          });
        }
      }
    }

    scanDir(downloadsDir);
    // Sort newest first
    files.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return files;
  } catch (err) {
    console.error('Error listing downloads:', err);
    return [];
  }
}

/**
 * Delete a downloaded file by relative path or file name
 */
export function deleteDownloadedFile(targetIdentifier) {
  try {
    const cleanRelative = targetIdentifier.replace(/^[\/\\]+/, '').replace(/\.\.[\/\\]/g, '');
    let targetPath = path.join(downloadsDir, cleanRelative);

    // If target not found directly, check subfolders
    if (!fs.existsSync(targetPath)) {
      for (const folder of Object.values(SUBFOLDERS)) {
        const candidate = path.join(downloadsDir, folder, path.basename(targetIdentifier));
        if (fs.existsSync(candidate)) {
          targetPath = candidate;
          break;
        }
      }
    }

    if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
      fs.unlinkSync(targetPath);
      return { success: true };
    }
    return { success: false, error: 'File not found' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Delete multiple selected files
 */
export function deleteMultipleFiles(filesList = []) {
  const results = { deleted: 0, failed: 0, errors: [] };
  for (const item of filesList) {
    const res = deleteDownloadedFile(item);
    if (res.success) {
      results.deleted++;
    } else {
      results.failed++;
      results.errors.push({ file: item, error: res.error });
    }
  }
  return results;
}

/**
 * Delete all files across all subfolders (preserves folder structure and .gitkeep)
 */
export function deleteAllFiles() {
  const results = { deleted: 0, failed: 0 };

  function purgeDir(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        purgeDir(full);
      } else if (entry.isFile()) {
        if (entry.name === '.gitkeep') continue;
        try {
          fs.unlinkSync(full);
          results.deleted++;
        } catch (e) {
          results.failed++;
        }
      }
    }
  }

  purgeDir(downloadsDir);
  return results;
}

/**
 * Open downloads folder or specific subfolder in OS Explorer / Finder / file manager
 */
export function openDownloadsFolder(subfolder = '') {
  const dir = getDownloadsDir(subfolder);
  try {
    if (process.platform === 'win32') {
      exec(`explorer.exe "${dir}"`);
    } else if (process.platform === 'darwin') {
      spawn('open', [dir], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('xdg-open', [dir], { detached: true, stdio: 'ignore' }).unref();
    }
    return { success: true, path: dir };
  } catch (err) {
    console.error('Failed to open folder:', err);
    return { success: false, error: err.message };
  }
}
