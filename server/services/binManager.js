import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

export function getYtDlpPath() {
  const binName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
  const localBin = path.join(rootDir, 'bin', binName);
  if (fs.existsSync(localBin)) {
    try {
      if (process.platform !== 'win32') fs.chmodSync(localBin, 0o755);
    } catch (e) {}
    return localBin;
  }
  return 'yt-dlp';
}

export function getFfmpegPath() {
  if (ffmpegInstaller && ffmpegInstaller.path && fs.existsSync(ffmpegInstaller.path)) {
    try {
      if (process.platform !== 'win32') fs.chmodSync(ffmpegInstaller.path, 0o755);
    } catch (e) {}
    return ffmpegInstaller.path;
  }
  const binName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  const localBin = path.join(rootDir, 'bin', binName);
  if (fs.existsSync(localBin)) {
    try {
      if (process.platform !== 'win32') fs.chmodSync(localBin, 0o755);
    } catch (e) {}
    return localBin;
  }
  return 'ffmpeg';
}

export function checkBinaries() {
  const ytDlp = getYtDlpPath();
  const ffmpeg = getFfmpegPath();
  return {
    ytDlp: {
      path: ytDlp,
      exists: fs.existsSync(ytDlp) || ytDlp === 'yt-dlp'
    },
    ffmpeg: {
      path: ffmpeg,
      exists: fs.existsSync(ffmpeg) || ffmpeg === 'ffmpeg'
    }
  };
}
