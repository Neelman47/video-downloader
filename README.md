# 🎬 StreamVault - YouTube Downloader & Media Merger

A full-stack web application built with **Node.js**, **Express**, **React 18 (Vite)**, and **Tailwind CSS** that analyzes YouTube videos and playlists, letting you download them in your preferred quality, dub language, trimmed segment, or subtitle format, and merge custom video, audio, and subtitle tracks.

> 📖 **Detailed Technical Specifications & API Documentation:** See [PROJECT_DETAILS.md](PROJECT_DETAILS.md).

---

## 🧭 Navigation & Core Features

StreamVault provides four dedicated top-level tabs:

### 1. 📥 Downloader (Main Screen)
- Paste any YouTube video or playlist link (`list=...`).
- Choose from **144p up to 4K 60fps** with container, codec, and bitrate indicators.
- Detects and lists **all available multi-language audio dub tracks**.
- **Video Metadata & SEO Insights**:
  - Video tags (SEO keywords) with one-click **Copy All Tags**.
  - Video hashtags with one-click **Copy Hashtags**.
  - Video category, publication date, and view count.
  - Channel name, avatar, subscriber count, and verified badge.
  - High-res thumbnail preview with **Download Thumbnail (HD)** button.
  - Complete list of captions with instant **.SRT** and **.VTT** download options.
  - Full expandable description viewer.
- **Video Trimming**: Interactive start and end time sliders with live clip duration calculation.
- **⚡ Turbo Multi-Threaded Chunk Accelerator**: Parallel multi-connection byte-range downloader with concurrent video+audio fetching and seamless chunk stitching.
- **Subtitles**: Download `.srt` or `.vtt` subtitles for any available language.
- **Playlists**: Full video checklist, batch selection, and sequential queue execution.

### 2. 📁 Browse (Dedicated Media Library)
- Dedicated media browser for all downloaded and merged files.
- **Category Filter Tabs**: All Files, Videos, Audio, Clips, Subtitles, Playlists, and Merged Items.
- **Date/Time Filter**: Today, Yesterday, Last Week, Last Month, Last 3 Months, Last 6 Months, Last Year, All Time.
- **Search Bar**: Real-time filtering by file name or folder.
- **Batch Actions**: Multi-select checkboxes, "Select All", "Delete Selected", and "Delete All".
- **One-Click Explorer**: Open the active subfolder directly in File Explorer (Windows), Finder (macOS), or xdg-open (Linux).

### 3. 🔀 Merge (Media Merger Engine & Subtitle Styling Studio)
- Combine custom media inputs into a single container:
  1. **Video File (Required)**: From downloaded library or uploaded from computer.
  2. **Audio Track (Optional)**: From downloaded library, uploaded from computer, or **None** with toggle to keep original video audio or mute.
  3. **Subtitle File (Optional)**: From downloaded library or uploaded from computer (.srt, .vtt, .ass).
  - *Flexibility*: Video is required, plus at least one of Audio or Subtitles (`Video + Audio`, `Video + Subtitles`, or `Video + Audio + Subtitles`).
- **Subtitle Modes**:
  - **Soft**: Selectable embedded track in MP4/MKV.
  - **Burn-in Directly**: Hardcoded directly onto the video frames.
- **Subtitle Styling Studio**:
  - Customize font family (Arial, Roboto, Impact, Trebuchet MS, etc.), font size (18pt–32pt), and text color with quick swatches and custom picker.
  - Choose background box style (Netflix/YouTube semi-transparent dark box, solid black box, or outline & drop shadow) with opacity slider.
  - Adjust bottom frame margin distance (10px, 25px, 45px), bold, and italics.
  - **Live 16:9 Cinema Preview Box**: Instant visual simulation showing the exact subtitle appearance and placement before rendering.
- **Output Container**: `.mp4` or `.mkv`.
- **Destination**: Exported into `downloads/merged_items/` with timestamp prefixes (`YYYYMMDD_HHMM_`).

### 4. 🎙️ Dubbing & TTS (AI Voice Studio)
- **AI Voice Dubber (English to Hindi / Gujarati)**:
  - Converts English audio files into natural Hindi or Gujarati speech.
  - **Background Preservation**: Uses Python Demucs local stem isolation (with FFmpeg vocal attenuation fallback) to preserve original music, instruments, and background effects while replacing only dialogue.
  - **Smart Mixing**: Automatically ducks background music by 70% during spoken dialogue and restores it during pauses.
  - **Gender Choice**: Auto-detect, Male (`hi-IN-MadhurNeural`, `gu-IN-NiranjanNeural`), or Female (`hi-IN-SwaraNeural`, `gu-IN-DhwaniNeural`).
  - **Free Translation Engine**: Gemini 1.5 Flash (with user API key drawer) or free Google Translate fallback.
  - **Destination**: Saved to `downloads/dubbed_audio/`.
- **Text to Audio (TTS Studio)**:
  - Turns custom script text (English, Hindi, or Gujarati) into studio-quality voiceovers.
  - **4 Distinct Delivery Personas / Tones**:
    - **Conversational**: Friendly, natural everyday dialogue.
    - **Professional / News**: Clear, steady, authoritative delivery.
    - **Energetic / Storyteller**: Expressive, dynamic pacing for entertainment & shorts.
    - **Calm / Audiobook**: Soothing, relaxed cadence for storytelling & relaxation.
  - **Modulation Controls**: Speed rate adjustment (`0.8x` to `1.4x`) and pitch shift (`-10Hz` to `+10Hz`).
  - **Destination**: Saved to `downloads/tts_audio/`.
- **Engine Status & Roadmap Info Box**:
  - Displays active engines (Microsoft Edge Neural TTS, Gemini 1.5 Flash, Demucs, FFmpeg) and future roadmap capabilities (Offline Whisper, Voice Cloning).

---

## 📁 Storage Subfolders

```
downloads/
├── videos/        # Full video streams
├── audio/         # Standalone audio tracks (.mp3 / .m4a)
├── clips/         # Trimmed clips
├── subtitles/     # Subtitle files (.srt / .vtt)
├── playlists/     # Playlist & batch downloads
├── merged_items/  # Outputs from the Media Merger
├── dubbed_audio/  # Outputs from the AI Voice Dubber
└── tts_audio/     # Outputs from the Text-to-Speech Studio
```

---

## 🚀 Quick Start

### Windows:
- Double-click `start.bat` (or run `npm start`) for Production mode (`http://localhost:5000`).
- Double-click `dev.bat` (or run `npm run dev`) for Development mode (`http://localhost:5173`).

### macOS & Linux:
```bash
./start.sh   # Production mode (http://localhost:5000)
# OR
./dev.sh     # Dev mode with hot reload (http://localhost:5173)
```

---

## 🛠️ Tech Stack & Versions

- **Frontend**: React 18 (`18.3.1`), Vite (`5.4.11`), Tailwind CSS (`3.4.17`), Lucide React (`0.468.0`)
- **Backend**: Node.js (`26.13.1`), Express (`4.21.2`), `@distube/ytdl-core` (`5.2.1`), `multer` (`1.4.5-lts.1`)
- **AI Voices & Dubbing**: `@andresaya/edge-tts` (`1.9.1`), Python Demucs (vocal isolation), Gemini 1.5 Flash
- **Media Engine**: FFmpeg (`4.1.3` bundled via `@ffmpeg-installer/ffmpeg`)
- **Communication**: REST API + Server-Sent Events (SSE)
