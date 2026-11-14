# 🎬 StreamVault - YouTube Video, Multi-Audio, Clip & Playlist Downloader

A full-stack web application built with **Node.js**, **Express**, **React 18 (Vite)**, and **Tailwind CSS** that analyzes YouTube videos and playlists, letting you download them in your preferred video quality, dub language, trimmed segment, or subtitle format.

> 📖 **Detailed Technical Specifications & API Documentation:** See [PROJECT_DETAILS.md](PROJECT_DETAILS.md).

---

## ✨ Key Features

1. **Intelligent Video & Playlist Analysis**:
   - Fetches title, channel name, thumbnail, duration, view count, and upload date.
   - Detects all video resolutions, multi-language dub tracks, and closed captions.
   - Smart playlist detection (`list=...`) with full video checklist.

2. **Available Video Quality Selection**:
   - Choose from **4K (2160p 60fps)**, **2K (1440p)**, **1080p (Full HD)**, **720p (HD)**, **480p**, **360p**, **240p**, and **144p**.
   - Displays FPS, container format (MP4 / WebM), codec (H.264 / VP9 / AV1), and estimated file size.

3. **Multi-Language Audio Track Selector**:
   - Detects and lists **all available audio languages and dub tracks** (e.g., English Original, Spanish, Hindi, French, German, Japanese, Arabic, etc.).
   - Matches the exact dub track selected by the user.

4. **Video Trimming & Clipping**:
   - Interactive start and end time sliders with live segment duration preview.
   - Frame-accurate clipping via FFmpeg `-ss` and `-t`.
   - Saves trimmed clips directly into `/downloads/clips/`.

5. **Subtitles & Closed Captions**:
   - Download subtitles in **`.srt`** (SubRip) or **`.vtt`** (WebVTT) format.
   - Supports both human-translated and auto-generated caption tracks.
   - Saves subtitles directly into `/downloads/subtitles/`.

6. **Playlists & Bulk Downloads**:
   - Paste any playlist link to view all videos with checkmarks.
   - "Select All" toggle or pick specific videos to download.
   - Batch progress tracking with sequential download queue.
   - Saves into `/downloads/playlists/`.

7. **Restructured Storage & Timestamp Prefixes**:
   - Subdirectories:
     - `downloads/videos/` — Full video downloads.
     - `downloads/audio/` — Audio-only downloads (MP3/M4A).
     - `downloads/subtitles/` — Subtitle files (`.srt` / `.vtt`).
     - `downloads/clips/` — Trimmed video and audio clips.
     - `downloads/playlists/` — Playlist and batch downloads.
   - Every file starts with timestamp: `YYYYMMDD_HHMM_videoname.ext`.

8. **Batch Deletion & Library Management**:
   - Filter by subfolder category tabs (**All**, **Videos**, **Audio**, **Clips**, **Subtitles**, **Playlists**).
   - Checkboxes with **"Select All"** and **"Delete Selected"**.
   - Safety-confirmed **"Delete All"** button.
   - One-click **"Open Folder"** in File Explorer (Windows), Finder (macOS), or xdg-open (Linux).

9. **Console URL Display**:
   - Running `npm start` or `npm run dev` prints clear, clickable project URLs in the terminal.

---

## 🚀 Quick Start

### 1. Requirements
- **Node.js**: `>= 18.0.0` (Tested on `v26.13.1`)
- **Operating System**: Windows, macOS, or Linux

### 2. Run the App

#### Windows:
- Double-click `start.bat` (or run `npm start`) for Production mode (`http://localhost:5000`).
- Double-click `dev.bat` (or run `npm run dev`) for Development mode (`http://localhost:5173`).

#### macOS & Linux:
```bash
./start.sh   # Production mode
# OR
./dev.sh     # Dev mode with hot reload
```

---

## 🛠️ Tech Stack & Versions

- **Frontend**: React 18 (`18.3.1`), Vite (`5.4.11`), Tailwind CSS (`3.4.17`), Lucide React (`0.468.0`)
- **Backend**: Node.js (`26.13.1`), Express (`4.21.2`), `@distube/ytdl-core` (`5.2.1`)
- **Media Engine**: FFmpeg (`4.1.3` bundled via `@ffmpeg-installer/ffmpeg`)
- **Communication**: REST API + Server-Sent Events (SSE)
