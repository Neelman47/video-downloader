# 📋 StreamVault — Comprehensive Project Documentation & Technical Specifications

---

## 1. Project Overview

- **Project Name:** StreamVault — YouTube Video, Multi-Audio, Subtitle Downloader & Media Merger
- **Project Directory:** `d:\Projects\yt-video-downloader`
- **Application Type:** Full-Stack Web Application (React SPA + Node.js Express Server)
- **Primary Features:** 4K video extraction, multi-language dubs, subtitle extraction (.srt/.vtt), video trimming, playlist queues, dedicated media library with date filters, and multi-track media merger (Video + Audio + Subtitles into `downloads/merged_items/`).

---

## 2. Navigation Architecture & Tabs

StreamVault is structured into three dedicated header tabs:

```
[ 🎬 StreamVault ]        [ 📥 Downloader ]  [ 📁 Browse (Count) ]  [ 🔀 Merge ]        [ 📂 Downloads Folder ]
```

### 1. Tab 1: Downloader (`/` or `#/`)
- Dedicated to YouTube video and playlist analysis and downloading.
- In-depth format dashboard: quality selector (144p to 4K 60fps), dub audio selector, subtitle options, and video clipping/trimming.
- **Video Metadata & SEO Insights Section**:
  - **Video Tags (SEO Keywords)** with one-click "Copy All Tags".
  - **Video Hashtags** extracted from title and description with "Copy Hashtags".
  - **Category**: Video category (e.g., Entertainment, Film & Animation, Gaming, Music).
  - **Channel Details**: Creator name, verified status badge, avatar, subscriber count, and direct link.
  - **High-Res Thumbnail**: High-resolution image preview with one-click "Download Thumbnail (HD)".
  - **Captions & Subtitles**: Complete track listing with direct `.SRT` and `.VTT` download buttons.
  - **Full Description**: Collapsible description viewer with link detection.
- Playlist detection and batch queue execution.
- Live real-time download progress bar.

### 2. Tab 2: Browse (`/browse` or `#/browse`)
- Dedicated Media Library for all downloaded and merged media.
- **Category Filter Tabs**:
  - **All Files**
  - **Videos** (`videos/`)
  - **Audio** (`audio/`)
  - **Clips** (`clips/`)
  - **Subtitles** (`subtitles/`)
  - **Playlists** (`playlists/`)
  - **Merged Items** (`merged_items/`)
- **Date/Time Filter**:
  - **All Time** (default)
  - **Today**
  - **Yesterday**
  - **Last Week** (last 7 days)
  - **Last Month** (last 30 days)
  - **Last 3 Months** (last 90 days)
  - **Last 6 Months** (last 180 days)
  - **Last Year** (last 365 days)
- **Search**: Instant text search by file name or folder.
- **Batch Actions**: Multi-select checkboxes, "Select All", "Delete Selected", and "Delete All".
- **File Actions**: Direct browser download, open in OS file explorer, single delete.

### 3. Tab 3: Merge (`/merge` or `#/merge`)
- Dedicated tool to merge video, audio, and subtitles into a single unified file.
- **Flexible Input Configuration**:
  1. **Video File (Required)**: Select from downloaded library (`videos/`, `clips/`, `playlists/`) or upload from computer.
  2. **Audio Track (Optional)**: Select from downloaded library (`audio/`), upload from computer, or choose **None** with options to **Keep original video audio** or **Mute**.
  3. **Subtitle File (Optional)**: Select from downloaded library (`subtitles/`), upload from computer (.srt, .vtt, .ass), or choose **None**.
  - *Validation Rule*: Video is required, and at least **one** of Audio or Subtitles must be selected (supports `Video + Audio`, `Video + Subtitles`, or `Video + Audio + Subtitles`).
- **Subtitle Modes**:
  - **Soft Subtitles**: Embedded as a selectable track in the MP4/MKV container (`-c:s mov_text` for MP4, `-c:s srt` for MKV).
  - **Burn-in Subtitles**: Permanently hardcoded onto video frames using FFmpeg's `subtitles` filter with custom styling.
- **Subtitle Styling Studio & 16:9 Cinema Live Preview**:
  - **Font Family**: Arial, Roboto, Trebuchet MS, Impact, Segoe UI, Verdana, Courier New, Georgia.
  - **Font Size**: 18pt, 22pt, 26pt, 32pt.
  - **Text Color**: Preset swatches (White `#FFFFFF`, Yellow `#FFE600`, Cyan `#00E5FF`, Green `#00FF66`, Orange `#FF9900`) + custom color picker.
  - **Background Box & Contrast**: Netflix/YouTube semi-transparent box (`BorderStyle=3`), Solid black box, Outline & drop shadow (`BorderStyle=1`), Thick outline.
  - **Box Opacity / Outline Thickness**: 20% to 100% opacity slider or 1px to 4px outline selector.
  - **Bottom Frame Distance**: Low (10px), Standard (25px), Raised (45px).
  - **Formatting**: Bold (`B`) and Italic (`I`) toggles.
  - **Real-Time 16:9 Cinema Preview**: Interactive simulation reflecting font, color, background box, and bottom margin in real time.
- **Output Container**: `.mp4` or `.mkv`.
- **Output Destination**: Automatically exported to `downloads/merged_items/` with timestamp prefix (`YYYYMMDD_HHMM_`).

---

## 3. Storage Architecture

```
downloads/
├── videos/        # Full video streams (MP4 / WebM / MKV)
├── audio/         # Audio-only tracks (MP3 / M4A)
├── clips/         # Trimmed segments
├── subtitles/     # Subtitle files (.srt / .vtt)
├── playlists/     # Playlist & batch downloads
└── merged_items/  # Outputs from the Media Merger engine
```

- Every downloaded or merged file follows the timestamp naming convention: `YYYYMMDD_HHMM_filename.ext`.

---

## 4. Technologies & Exact Versions Used

| Component | Technology | Exact Version | Role |
|---|---|---|---|
| **Runtime** | Node.js | `v26.13.1` (Min `>= 18.0.0`) | JavaScript execution environment |
| **Package Manager** | npm | `11.20.0` | Package manager |
| **Backend Server** | Express | `^4.21.2` | REST & SSE API server |
| **YouTube Engine** | @distube/ytdl-core | `^5.2.1` | YouTube stream, metadata, subtitle, and playlist parser |
| **Media Processor** | FFmpeg | `v4.1.3` (bundled) | Audio/video multiplexing, trimming, and subtitle rendering |
| **File Uploads** | multer | `^1.4.5-lts.1` | Multipart file uploads for external PC files |
| **Frontend UI** | React | `^18.3.1` | Component UI library |
| **Build Tool** | Vite | `^5.4.11` | Hot module replacement & production bundler |
| **CSS Framework** | Tailwind CSS | `^3.4.17` | Utility-first responsive styling |
| **Icons** | Lucide React | `^0.468.0` | Modern SVG interface icons |

---

## 5. API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/system/status` | System readiness, FFmpeg check, and storage directory info |
| `POST` | `/api/analyze` | Analyze YouTube video (resolutions, dub audio, subtitles) |
| `POST` | `/api/playlist/analyze` | Analyze YouTube playlist (metadata and video checklist) |
| `POST` | `/api/download` | Start single video/audio/clip download |
| `POST` | `/api/download/subtitle` | Download subtitle track as `.srt` or `.vtt` |
| `POST` | `/api/merge` | Merge Video + Audio + Subtitles into `downloads/merged_items/` |
| `POST` | `/api/merge/cancel/:jobId` | Cancel in-flight merge job |
| `GET` | `/api/files` | List all files across all subfolders |
| `DELETE` | `/api/files/:fileName` | Delete single downloaded file |
| `POST` | `/api/files/delete-multiple` | Delete selected array of files |
| `POST` | `/api/files/delete-all` | Purge all files across all subfolders |
| `GET` | `/api/files/download` | Direct browser download (`?file=<path>`) |
| `POST` | `/api/files/open-folder` | Open specific subfolder in OS Explorer / Finder / xdg-open |

---

## 6. How to Run

### Production Mode:
```bash
npm start
# OR double-click start.bat on Windows / ./start.sh on macOS/Linux
# App URL: http://localhost:5000
```

### Development Mode:
```bash
npm run dev
# OR double-click dev.bat on Windows / ./dev.sh on macOS/Linux
# Frontend: http://localhost:5173 | Backend: http://localhost:5000
```
