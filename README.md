# 🎬 StreamVault - YouTube Video & Multi-Audio Downloader

A full-stack web application built with **Node.js**, **Express**, **React (Vite)**, and **Tailwind CSS** that analyzes YouTube videos and lets you download them in your preferred video quality and audio language.

> 📖 **Detailed Technical Specifications & Architecture:** See [PROJECT_DETAILS.md](PROJECT_DETAILS.md) for full technology versions, system requirements, data flow diagram, and complete API specifications.

---

## ✨ Features

1. **Intelligent Video Analysis**:
   - Fetches title, high-resolution thumbnail, duration, view count, channel name, and upload date.
   - Detects all available video streams and multi-language audio streams.

2. **Available Video Quality Selector**:
   - Choose from all available resolutions: **4K (2160p 60fps)**, **2K (1440p)**, **1080p (Full HD)**, **720p (HD)**, **480p**, **360p**, **240p**, and **144p**.
   - Displays FPS, container format (MP4 / WebM), codec (H.264 / VP9 / AV1), and estimated file size.

3. **Multi-Language Audio Track Selector**:
   - Detects and lists **all available audio languages and dub tracks** (e.g. English Original, Spanish, Hindi, French, German, Japanese, Arabic, etc.).
   - Shows audio bitrates (e.g. 130 kbps, 160 kbps).

4. **Flexible Download Modes**:
   - 🎬 **Video + Audio (Merged)**: Merges your chosen video resolution with your chosen audio language into a single MP4/MKV file using FFmpeg.
   - 📹 **Video Only**: Downloads the silent high-definition video stream.
   - 🎵 **Audio Only**: Downloads the audio track in your selected language as MP3 or M4A.

5. **Local File Storage (`/downloads`)**:
   - All completed downloads are automatically stored in the project's `downloads/` directory.
   - Built-in library view to inspect downloaded files, check file sizes, and delete files.
   - One-click button to **Open Downloads Folder** in Windows File Explorer.
   - Option to directly save/download files to your browser.

6. **Live Real-Time Progress Tracking**:
   - Powered by Server-Sent Events (SSE) with automatic REST polling fallback.
   - Shows live download percentage, transfer speed (MB/s), countdown ETA, and processing status.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Lucide React icons
- **Backend**: Node.js (ES Modules), Express.js
- **Media Processing**: `@distube/ytdl-core`, `ffmpeg-static` (bundled FFmpeg binary)
- **Communication**: REST API + Server-Sent Events (SSE)

---

## 🚀 Quick Start (Windows, macOS & Linux)

### 1. Install Dependencies

To install both backend and frontend dependencies in one command:
```bash
npm run install:all
```

### 2. Run the Application

#### On Windows:
- **Production mode:** Double-click `start.bat` or run:
  ```bash
  npm start
  ```
- **Development mode:** Double-click `dev.bat` or run:
  ```bash
  npm run dev
  ```

#### On macOS & Linux:
- **Production mode:**
  ```bash
  chmod +x start.sh && ./start.sh
  # or standard npm
  npm start
  ```
- **Development mode:**
  ```bash
  chmod +x dev.sh && ./dev.sh
  # or standard npm
  npm run dev
  ```

### 3. Open in Browser

Open your browser and navigate to:
```
http://localhost:5000
```
*(or `http://localhost:5173` if running Vite dev server)*

---

## 📁 Project Structure

```
yt-video-downloader/
├── client/                     # React Frontend (Vite + Tailwind CSS)
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx           # Header & folder launcher
│   │   │   ├── UrlInput.jsx         # Input bar with samples & clipboard paste
│   │   │   ├── VideoCard.jsx        # Video thumbnail, channel, views preview
│   │   │   ├── FormatSelector.jsx   # Quality & audio language selection UI
│   │   │   ├── DownloadProgress.jsx # Live progress bar, speed & ETA
│   │   │   └── DownloadedList.jsx   # List of downloaded files in /downloads
│   │   ├── App.jsx                  # Main page coordinator
│   │   └── index.css                # Tailwind styling & glassmorphism
│   ├── index.html
│   └── vite.config.js
├── server/                     # Node.js Express Backend
│   ├── services/
│   │   ├── downloader.js       # Video info extraction, format grouping & muxing
│   │   ├── storage.js          # File storage & Windows Explorer integration
│   │   └── binManager.js       # FFmpeg and binary detection
│   ├── routes/
│   │   └── api.js              # REST endpoints & SSE progress streams
│   └── index.js                # Express entrypoint & static serving
├── downloads/                  # Output directory where files are stored
├── package.json                # Orchestration scripts
└── README.md
```

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/system/status` | Check FFmpeg and system engine readiness |
| `POST` | `/api/analyze` | Analyzes YouTube URL and returns video info, video qualities, and audio languages |
| `POST` | `/api/download` | Initiates download with selected video quality, audio language, and mode |
| `GET` | `/api/download/status/:jobId` | Poll download job status |
| `GET` | `/api/download/progress/:jobId` | Server-Sent Events stream for live progress |
| `POST` | `/api/download/cancel/:jobId` | Cancels active download |
| `GET` | `/api/files` | Lists all files stored in `downloads/` |
| `DELETE` | `/api/files/:fileName` | Deletes a downloaded file |
| `GET` | `/api/files/download/:fileName` | Streams file to browser |
| `POST` | `/api/files/open-folder` | Opens `downloads/` in Windows File Explorer |
