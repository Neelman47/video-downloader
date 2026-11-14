# 📋 Project Documentation & Technical Specifications

---

## 1. Project Overview

**Project Name:** StreamVault — YouTube Video & Multi-Audio Downloader  
**Project Path:** `d:\Projects\yt-video-downloader`  
**Application Type:** Full-Stack Web Application (SPA Client + REST & SSE API Server)  

### What is this Project?
StreamVault is a modern web application designed to download YouTube videos directly to a local directory (`downloads/`). Unlike conventional downloaders that restrict users to predefined, low-resolution streams, this application first performs an in-depth **metadata analysis** of the target YouTube URL. Before initiating any download, it presents an interactive configuration dashboard allowing the user to:
1. Inspect and select from all available **video qualities** (ranging from 144p up to 4K 60fps).
2. Detect and select from all available **multi-language audio tracks** (including YouTube's new multi-dub tracks, e.g. English Original, Spanish, Hindi, French, German, Japanese, Arabic, etc.).
3. Choose the **download mode**:
   - **Video + Audio**: Downloads high-definition video and your chosen language audio track and seamlessly merges them into a single file via FFmpeg.
   - **Video Only**: Downloads the video stream without sound.
   - **Audio Only**: Downloads and saves the selected audio track as MP3 or M4A.

---

## 2. Core Features & Capabilities

### 🔍 1. In-Depth Video Analysis
- **Metadata Extraction**: Retrieves video title, author/channel, high-resolution thumbnail, duration, view count, and upload date.
- **Adaptive Stream Parsing**: Categorizes separate DASH video and audio streams served by YouTube's modern media delivery system.
- **Quick-Sample Buttons**: Includes one-click test buttons for sample 4K and multi-language videos directly on the UI for quick validation.

### 🎥 2. Granular Video Quality Selection
- Groups resolutions dynamically: **4K (2160p 60fps)**, **2K (1440p)**, **1080p (Full HD)**, **720p (HD)**, **480p**, **360p**, **240p**, and **144p**.
- Displays frame rates (30fps / 60fps), video codecs (AVC1 / H.264, VP9, AV1), container formats (MP4, WebM), and calculated approximate file sizes.

### 🌐 3. Multi-Language Audio Detection & Selection
- Extracts YouTube's multi-track audio features (commonly used by international creators, educational channels, and studio content).
- Identifies and labels languages clearly (e.g. `English (US) original`, `Spanish`, `Hindi`, `French`, `German`, `Japanese`, `Arabic`, `Italian`, `Bangla`, etc.).
- Displays individual track audio bitrates (e.g. 130 kbps, 160 kbps).

### ⚙️ 4. Three Download Modes
- **Mode A: Video + Audio (Combined)**: Combines separate high-res video and specific language audio streams via FFmpeg muxing (`-c:v copy -c:a aac`).
- **Mode B: Video Only**: Direct stream of the visual video track without audio.
- **Mode C: Audio Only**: Direct extraction of the selected language audio track as standalone MP3 or M4A.

### 📊 5. Live Real-Time Progress Tracking
- **Server-Sent Events (SSE)** with automatic fallback to polling.
- Live progress bar displaying:
  - Download percentage (`0% - 100%`)
  - Real-time transfer speed (`e.g. 680 KB/s` or `5.2 MB/s`)
  - Estimated Time of Arrival (ETA) countdown
  - Transferred bytes vs total size
  - Active status message (`Downloading video...`, `Downloading audio...`, `Merging with FFmpeg...`, `Completed!`)
- One-click **Cancel Download** button to abort in-flight streams.

### 📂 6. Local Storage & Downloads Library
- All files are saved into the dedicated `downloads/` folder inside the project root.
- **"Open Folder" Action**: Launches the host operating system's file manager (Windows File Explorer) pointing directly to the downloads folder.
- **Built-in File Library**:
  - Lists previously downloaded files with format badges, file sizes, and creation dates.
  - One-click **Save to Browser** (direct device download).
  - One-click **Delete File** with instant list update.

---

## 3. Technologies & Exact Versions Used

### 🟢 Runtime & Package Manager
| Technology | Exact Version | Purpose |
|---|---|---|
| **Node.js** | `v26.13.1` (Minimum: `>= 18.0.0`) | JavaScript runtime environment |
| **npm** | `11.20.0` (Minimum: `>= 9.0.0`) | Package manager and script executor |

### 🖥️ Backend (Server)
| Package / Tool | Exact Installed Version | Role & Description |
|---|---|---|
| **express** | `^4.22.3` | Fast, lightweight HTTP web framework for routing and middleware |
| **@distube/ytdl-core** | `^5.2.1` | Modern, actively maintained YouTube metadata extractor and stream handler |
| **ffmpeg-static** | `^5.3.0` | Bundled, platform-specific standalone FFmpeg binary for Windows/Linux/macOS |
| **cors** | `^2.8.6` | Cross-Origin Resource Sharing middleware for Vite dev server proxying |

### 🎨 Frontend (Client)
| Package / Tool | Exact Installed Version | Role & Description |
|---|---|---|
| **react** | `^18.3.1` | Core UI library for component-based reactive state management |
| **react-dom** | `^18.3.1` | React renderer for the browser DOM |
| **vite** | `^5.4.21` | High-speed frontend build tool and development server |
| **@vitejs/plugin-react** | `^4.7.0` | Babel/Fast Refresh plugin for React in Vite |
| **tailwindcss** | `^3.4.19` | Utility-first CSS framework for modern styling |
| **postcss** | `^8.5.32` | Tool for transforming styles with CSS plugins |
| **autoprefixer** | `^10.6.2` | PostCSS plugin to parse CSS and add vendor prefixes |
| **lucide-react** | `^1.72.0` | Clean, customizable modern SVG icon library |

---

## 4. System Requirements

To run this application smoothly, ensure your environment meets the following specifications:

| Requirement | Minimum Specification | Recommended |
|---|---|---|
| **Operating System** | Windows 10/11 (64-bit), macOS 11+, or Linux | Windows 11 (64-bit) |
| **Node.js** | `>= 18.0.0` | `v20.x` or `v26.x` LTS/Current |
| **npm** | `>= 9.0.0` | `v10.x` or `v11.x` |
| **Internet Access** | Required (to fetch video streams from YouTube) | Broadband / High-speed |
| **Disk Space** | ~300 MB for project dependencies + space for downloads | 5 GB+ free space |
| **RAM** | 2 GB minimum | 4 GB+ |
| **Browser** | Chrome, Edge, Firefox, Safari (modern ES6+ compliant) | Google Chrome or Microsoft Edge |

---

## 5. Architecture & Data Flow

```
[ User Browser (React Client) ]
           │
           │ 1. POST /api/analyze (YouTube URL)
           ▼
[ Express API Server (port 5000) ]
           │
           │ 2. ytdl.getInfo(url)
           ▼
[ YouTube Servers ] ───> Metadata, Formats, Audio Tracks returned
           │
           │ 3. Formats & Audio Languages JSON sent to Client
           ▼
[ User selects Video Quality, Audio Language & Mode ]
           │
           │ 4. POST /api/download (Itags, Mode, Container)
           ▼
[ Downloader Service ]
    ├── Streams Video Track ───┐
    ├── Streams Audio Track ───┼──> [ FFmpeg Muxer ] (if Mode = Both)
    └── Direct Stream ─────────┘               │
                                               ▼
                                  [ downloads/ folder ]
                                               │
                                  [ Server-Sent Events (SSE) ]
                                               │ (Live % updates)
                                               ▼
                                    [ User Browser UI ]
```

---

## 6. Directory Structure

```
d:\Projects\yt-video-downloader/
├── PROJECT_DETAILS.md            # Comprehensive technical documentation (this file)
├── README.md                     # Quick overview and usage guide
├── package.json                  # Root orchestration scripts (dev, start, build)
├── dev.js                        # Concurrently launches client & server for development
│
├── downloads/                    # Target storage folder for all downloaded files
│
├── bin/                          # Standalone binary fallbacks
│
├── server/                       # Node.js + Express Backend
│   ├── package.json              # Backend dependencies
│   ├── index.js                  # Main server entrypoint & static client server
│   ├── routes/
│   │   └── api.js                # API endpoints (analyze, download, files, SSE)
│   └── services/
│       ├── downloader.js         # Video analysis, stream downloading, FFmpeg muxing
│       ├── storage.js            # File listing, deletion, Windows Explorer launcher
│       └── binManager.js         # Binary resolver (FFmpeg, yt-dlp)
│
└── client/                       # React 18 + Vite Frontend
    ├── package.json              # Frontend dependencies
    ├── vite.config.js            # Vite configuration with API proxy to port 5000
    ├── tailwind.config.js        # Tailwind CSS theme & extensions
    ├── postcss.config.js         # PostCSS plugins
    ├── index.html                # Single-page HTML entrypoint
    ├── dist/                     # Optimized production bundle served by Express
    └── src/
        ├── main.jsx              # React DOM mounting
        ├── index.css             # Tailwind base & glassmorphism styles
        ├── App.jsx               # Master dashboard view
        └── components/
            ├── Navbar.jsx           # Top navigation & system status
            ├── UrlInput.jsx         # Input bar, paste button & sample links
            ├── VideoCard.jsx        # Video thumbnail, channel, views badge
            ├── FormatSelector.jsx   # Video quality & audio language selection UI
            ├── DownloadProgress.jsx # Real-time progress bar, speed & ETA
            └── DownloadedList.jsx   # Downloaded files manager & actions
```

---

## 7. REST & Real-Time API Endpoints

| Method | Endpoint | Description | Request Body |
|---|---|---|---|
| `GET` | `/api/system/status` | Reports FFmpeg availability and download path | None |
| `POST` | `/api/analyze` | Fetches metadata, video qualities, and audio languages | `{ "url": "https://..." }` |
| `POST` | `/api/download` | Initiates download with chosen options | `{ "url": "...", "mode": "both"|"video_only"|"audio_only", "videoItag": 137, "audioItag": 140, "container": "mp4" }` |
| `GET` | `/api/download/status/:jobId` | Polls current status of download job | None |
| `GET` | `/api/download/progress/:jobId`| Server-Sent Events (SSE) stream for live progress | None |
| `POST` | `/api/download/cancel/:jobId` | Aborts active download stream | None |
| `GET` | `/api/files` | Lists all files in `downloads/` directory | None |
| `DELETE`| `/api/files/:fileName` | Deletes a downloaded file | None |
| `GET` | `/api/files/download/:fileName`| Direct download stream to browser | None |
| `POST` | `/api/files/open-folder` | Opens Windows Explorer at `downloads/` folder | None |

---

## 8. How to Run the Application (Windows, macOS & Linux)

### Option A: Production Mode (Recommended)
This runs the production-optimized React build served directly by the Express server on a single port (`http://localhost:5000`):

- **Windows:**
  ```bash
  # Double-click start.bat or run:
  npm start
  ```
- **macOS & Linux:**
  ```bash
  chmod +x start.sh && ./start.sh
  # or standard npm
  npm start
  ```

### Option B: Development Mode (Hot-Reloading)
This runs both the Express backend (port 5000) and the Vite development server (port 5173) with live hot-reloading:

- **Windows:**
  ```bash
  # Double-click dev.bat or run:
  npm run dev
  ```
- **macOS & Linux:**
  ```bash
  chmod +x dev.sh && ./dev.sh
  # or standard npm
  npm run dev
  ```

### Option C: Rebuilding the Frontend
If you make changes to any frontend component in `client/src`:
```bash
npm run build
```
The output is automatically generated in `client/dist/` and served by `npm start`.

### Option D: Installing All Dependencies from Scratch
```bash
npm run install:all
```

---

## 9. Verification & Testing Conducted

The following end-to-end tests were performed and confirmed working:
- **System Check**: Verified `ffmpeg.exe` binary execution and path resolution.
- **Analysis Testing**: Tested standard 4K video (`Big Buck Bunny`) and multi-language video (`$456,000 Squid Game In Real Life` with 24 distinct audio tracks).
- **Download Testing**: Executed real downloads, validated live SSE progress updates, and verified files saved into `d:\Projects\yt-video-downloader\downloads`.
- **Client Build**: Compiled production assets with zero errors using Vite and PostCSS.
