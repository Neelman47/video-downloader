# 📋 StreamVault — Comprehensive Project Documentation & Technical Specifications

---

## 1. Project Overview

- **Project Name:** StreamVault — YouTube Video & Multi-Audio Downloader
- **Project Directory:** `d:\Projects\yt-video-downloader`
- **Application Type:** Full-Stack Web Application (React Single Page Application + Node.js Express REST & SSE Server)
- **Primary Audience:** Users seeking high-definition YouTube downloads (up to 4K 60fps), multi-language dub audio tracks, closed captions/subtitles, precise video trimming/clipping, and bulk/playlist downloads with local file organization.

### What is this Project?
StreamVault is a full-stack media extraction application designed to download YouTube content directly to organized local storage (`downloads/`). Unlike standard YouTube downloaders that force users into low-resolution progressive streams or unpredictable dub tracks, StreamVault performs an in-depth **metadata and stream analysis** of any YouTube link before initiating a download.

It gives the user complete control over:
1. **Video Quality**: 144p up to 4K 60fps (with container, bitrate, and codec detection).
2. **Audio Track & Language**: Detects all dub languages (e.g., English, Spanish, Hindi, French, German, Japanese, Arabic, etc.).
3. **Download Mode**: Full Video+Audio (FFmpeg merged), Silent Video Only, or Audio Only (MP3/M4A).
4. **Subtitles / Closed Captions**: Download `.srt` or `.vtt` subtitles for any available language.
5. **Video Trimming & Clipping**: Interactive start/end time slider to download specific segments (e.g., from 01:15 to 02:30).
6. **Playlists & Bulk Downloads**: Analyze playlists, select specific videos with checkmarks, and process a batch download queue.
7. **Organized Subfolders**: Saves into structured subdirectories (`videos/`, `audio/`, `subtitles/`, `clips/`, `playlists/`) with timestamp prefixes (`YYYYMMDD_HHMM_videoname.ext`).

---

## 2. All Features & Capabilities

### 🔍 1. In-Depth Video & Metadata Analysis
- **Metadata Extraction**: Fetches title, channel name, thumbnail, duration, view count, and publication date.
- **Adaptive Stream Parsing**: Separates video and audio streams for flexible mixing.
- **Quick-Sample Buttons**: Includes one-click test samples for 4K video, multi-language dubs (MrBeast), and playlists (Lex Fridman).

### 🎥 2. Granular Video Quality Selection
- Groups resolutions dynamically: **4K (2160p 60fps)**, **2K (1440p)**, **1080p (Full HD)**, **720p (HD)**, **480p**, **360p**, **240p**, and **144p**.
- Displays frame rates (30fps / 60fps), video codecs (AVC1 / H.264, VP9, AV1), container formats (MP4, WebM), and approximate file sizes.

### 🌐 3. Multi-Language Audio Detection & Selection
- Extracts YouTube's multi-track audio features (used by international creators and studio channels).
- Identifies and labels languages clearly (e.g. `English (US) original`, `Spanish`, `Hindi`, `French`, `German`, `Japanese`, `Arabic`, `Italian`, etc.).
- Displays individual track audio bitrates (e.g. 128 kbps, 160 kbps).

### ✂️ 4. Video Trimming & Clipping
- Start time and end time range slider and inputs in the UI.
- Displays real-time clip duration preview (e.g., `Selected Clip: 01:15 to 02:30 (Duration: 01:15)`).
- Quick presets: "First 30s", "First 60s", "Full Video".
- Frame-accurate segment cutting using FFmpeg `-ss` and `-t` without quality loss.
- Automatically routes clipped media to `downloads/clips/`.

### 📝 5. Subtitles & Closed Captions Download
- Detects all available subtitle tracks from YouTube (original and auto-generated).
- Supports downloading subtitles in **SubRip (`.srt`)** or **WebVTT (`.vtt`)** format.
- Automatic WebVTT to SRT conversion with cleaned timestamp cues.
- Automatically routes subtitles to `downloads/subtitles/`.

### 📚 6. Playlists & Bulk Downloads
- Paste any YouTube playlist URL containing `list=...`.
- Displays playlist title, channel name, total video count, and video checklist.
- Select all or pick individual videos to download.
- Batch quality and mode selection (Video+Audio or MP3 Audio).
- Sequential download queue with real-time progress for each item.
- Automatically routes playlist files to `downloads/playlists/`.

### 📁 7. Restructured Downloads Directory & Timestamping
- **Subfolder Layout**:
  - `downloads/videos/` — Full video downloads.
  - `downloads/audio/` — Audio-only downloads (MP3/M4A).
  - `downloads/subtitles/` — Subtitle files (`.srt` / `.vtt`).
  - `downloads/clips/` — Trimmed video and audio clips.
  - `downloads/playlists/` — Playlist and batch downloads.
- **Timestamp Prefix**: Every downloaded file starts with `YYYYMMDD_HHMM_` followed by the video title and tags (e.g., `20261114_1230_Squid Game In Real Life [Hindi] [0e3GPea1Tyg].mp4`).

### 🗑️ 8. Batch Deletion & File Management
- Category filter tabs in the UI: **All**, **Videos**, **Audio**, **Clips**, **Subtitles**, **Playlists**.
- Individual checkboxes for each file and a **"Select All"** toggle.
- **"Delete Selected"** button with confirmation modal.
- **"Delete All"** button with safety confirmation modal.
- **"Open Folder"** button that opens the current subfolder directly in File Explorer (Windows), Finder (macOS), or xdg-open (Linux).
- Direct browser download link for any saved item.

### 🌐 9. Console URL Printing
- When running `npm start`, displays prominent clickable URLs in console:
  - App Web UI: `http://localhost:5000`
  - Backend API: `http://localhost:5000/api`
  - Downloads Folder path
- When running `npm run dev`, displays:
  - Frontend Dev UI: `http://localhost:5173`
  - Backend API: `http://localhost:5000`

---

## 3. Technologies & Exact Versions Used

### 🟢 Runtime & Core Tools
| Technology | Installed Version | Purpose |
|---|---|---|
| **Node.js** | `v26.13.1` (Min: `>= 18.0.0`) | JavaScript runtime environment |
| **npm** | `11.20.0` (Min: `>= 9.0.0`) | Package manager |
| **FFmpeg** | `v4.1.3` (bundled via `@ffmpeg-installer`) | Cross-platform audio/video multiplexing, trimming, and conversion |

### 🖥️ Backend (Server)
| Package | Installed Version | Role & Description |
|---|---|---|
| **express** | `^4.21.2` | HTTP web server and REST routing |
| **@distube/ytdl-core** | `^5.2.1` | YouTube metadata parsing, stream downloading, captions, and playlists |
| **@ffmpeg-installer/ffmpeg** | `^1.1.0` | Pre-bundled FFmpeg binary installer for Windows, macOS, and Linux |
| **cors** | `^2.8.5` | Cross-Origin Resource Sharing middleware |

### 🎨 Frontend (Client)
| Package | Installed Version | Role & Description |
|---|---|---|
| **react** | `^18.3.1` | Component UI library |
| **react-dom** | `^18.3.1` | React DOM renderer |
| **vite** | `^5.4.11` | Next-generation frontend build tool and dev server |
| **tailwindcss** | `^3.4.17` | Utility-first CSS styling framework |
| **lucide-react** | `^0.468.0` | Modern SVG icons |

---

## 4. Cross-Platform Compatibility (Windows, macOS & Linux)

The project has been configured to run seamlessly across all major operating systems:
- **Windows**:
  - Double-click `start.bat` for production mode.
  - Double-click `dev.bat` for development mode.
- **macOS & Linux**:
  - Run `./start.sh` for production mode.
  - Run `./dev.sh` for development mode.
  - POSIX file permissions (`0o755`) are automatically applied to FFmpeg binaries.
  - File manager opening utilizes `open` on macOS and `xdg-open` on Linux.
- **Git CRLF/LF Configuration**:
  - `.gitattributes` enforces standard `LF` line endings across all platforms.

---

## 5. API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/system/status` | Health check, FFmpeg status, and storage directory info |
| `POST` | `/api/analyze` | Analyze single YouTube video URL (qualities, dubs, captions) |
| `POST` | `/api/playlist/analyze` | Analyze YouTube playlist URL (video list and metadata) |
| `POST` | `/api/download` | Start video, audio, or trimmed clip download |
| `POST` | `/api/download/subtitle` | Download subtitle track as `.srt` or `.vtt` |
| `GET` | `/api/download/status/:jobId` | Polling endpoint for job progress |
| `GET` | `/api/download/progress/:jobId` | Server-Sent Events (SSE) real-time stream |
| `POST` | `/api/download/cancel/:jobId` | Cancel active download job |
| `GET` | `/api/files` | List all downloaded files across subfolders |
| `DELETE` | `/api/files/:fileName` | Delete single downloaded file |
| `POST` | `/api/files/delete-multiple` | Delete array of selected files |
| `POST` | `/api/files/delete-all` | Purge all downloaded files across subfolders |
| `GET` | `/api/files/download` | Direct browser download (`?file=<path>`) |
| `POST` | `/api/files/open-folder` | Open downloads folder (or subfolder) in OS file manager |

---

## 6. How to Run the Project

### Production Mode (Single Command)
```bash
npm start
```
- Starts the Express server on port `5000` (serving both backend API and the built React frontend).
- Open **`http://localhost:5000`** in any browser.

### Development Mode (Hot Reload)
```bash
npm run dev
```
- Starts the Vite client dev server at **`http://localhost:5173`** and Express API server at **`http://localhost:5000`**.
