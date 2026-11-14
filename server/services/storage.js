import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec, spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');
const downloadsDir = path.join(rootDir, 'downloads');

// Ensure downloads directory exists
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

export function getDownloadsDir() {
  return downloadsDir;
}

export function listDownloadedFiles() {
  try {
    if (!fs.existsSync(downloadsDir)) return [];
    
    const entries = fs.readdirSync(downloadsDir, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
      if (entry.isFile()) {
        const fullPath = path.join(downloadsDir, entry.name);
        const stats = fs.statSync(fullPath);
        
        // Skip partial temporary download files (.part, .ytdl)
        if (entry.name.endsWith('.part') || entry.name.endsWith('.ytdl')) {
          continue;
        }

        const ext = path.extname(entry.name).toLowerCase();
        let type = 'unknown';
        if (['.mp4', '.mkv', '.webm', '.avi', '.mov'].includes(ext)) {
          type = 'video';
        } else if (['.mp3', '.m4a', '.wav', '.opus', '.aac', '.flac'].includes(ext)) {
          type = 'audio';
        }

        files.push({
          name: entry.name,
          path: fullPath,
          size: stats.size,
          sizeFormatted: formatBytes(stats.size),
          createdAt: stats.birthtime || stats.ctime,
          modifiedAt: stats.mtime,
          extension: ext.replace('.', ''),
          type
        });
      }
    }

    // Sort newest first
    files.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return files;
  } catch (err) {
    console.error('Error listing downloads:', err);
    return [];
  }
}

export function deleteDownloadedFile(fileName) {
  // Prevent directory traversal
  const safeName = path.basename(fileName);
  const targetPath = path.join(downloadsDir, safeName);
  
  if (fs.existsSync(targetPath)) {
    fs.unlinkSync(targetPath);
    return { success: true };
  }
  return { success: false, error: 'File not found' };
}

export function openDownloadsFolder() {
  const dir = getDownloadsDir();
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
    console.error('Failed to open downloads folder:', err);
    return { success: false, error: err.message };
  }
}

export function formatBytes(bytes, decimals = 2) {
  if (!+bytes) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
