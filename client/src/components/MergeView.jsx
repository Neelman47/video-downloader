import React, { useState, useMemo } from 'react';
import {
  Layers,
  Film,
  Music,
  Subtitles,
  UploadCloud,
  CheckCircle2,
  HardDrive,
  Download,
  FolderOpen,
  Loader2,
  X,
  Sparkles,
  AlertCircle,
  FileText,
  Volume2,
  VolumeX,
  Type,
  Palette,
  Sliders,
  Eye,
  Settings2,
  Check,
  Flame,
  Play
} from 'lucide-react';

const FONT_OPTIONS = [
  'Arial',
  'Roboto',
  'Trebuchet MS',
  'Impact',
  'Segoe UI',
  'Verdana',
  'Courier New',
  'Georgia'
];

const PRESET_COLORS = [
  { label: 'White', hex: '#FFFFFF' },
  { label: 'Yellow', hex: '#FFE600' },
  { label: 'Cyan', hex: '#00E5FF' },
  { label: 'Green', hex: '#00FF66' },
  { label: 'Orange', hex: '#FF9900' }
];

const BG_STYLE_PRESETS = [
  { id: 'box', name: 'Netflix / YouTube Box', desc: 'Semi-transparent dark box behind text', borderStyle: 3, bgOpacity: 65, outline: 0, shadow: 0 },
  { id: 'solid-box', name: 'Solid Black Box', desc: '100% opaque solid black background', borderStyle: 3, bgOpacity: 100, outline: 0, shadow: 0 },
  { id: 'outline', name: 'Outline & Drop Shadow', desc: 'Clean outline with gentle drop shadow', borderStyle: 1, bgOpacity: 0, outline: 2, shadow: 1 },
  { id: 'thick-outline', name: 'Thick Outline', desc: 'Heavy dark border for high contrast', borderStyle: 1, bgOpacity: 0, outline: 3, shadow: 2 }
];

export default function MergeView({
  files = [],
  onMergeComplete,
  onOpenFolder,
  onDownloadFile
}) {
  // 1. Available media files grouped from library
  const videoFiles = useMemo(() => {
    return files.filter((f) => ['videos', 'clips', 'playlists'].includes(f.category) || f.type === 'video');
  }, [files]);

  const audioFiles = useMemo(() => {
    return files.filter((f) => f.category === 'audio' || f.type === 'audio');
  }, [files]);

  const subtitleFiles = useMemo(() => {
    return files.filter((f) => f.category === 'subtitles' || f.type === 'subtitle');
  }, [files]);

  // Video Slot State (Required)
  const [videoMode, setVideoMode] = useState('library'); // 'library' | 'upload'
  const [selectedVideoPath, setSelectedVideoPath] = useState(videoFiles[0]?.relativePath || '');
  const [uploadedVideo, setUploadedVideo] = useState(null);

  // Audio Slot State (Optional: 'library' | 'upload' | 'none')
  const [audioMode, setAudioMode] = useState('library'); // 'library' | 'upload' | 'none'
  const [selectedAudioPath, setSelectedAudioPath] = useState(audioFiles[0]?.relativePath || '');
  const [uploadedAudio, setUploadedAudio] = useState(null);
  const [keepOriginalAudio, setKeepOriginalAudio] = useState(true);

  // Subtitle Slot State (Optional: 'none' | 'library' | 'upload')
  const [subtitleMode, setSubtitleMode] = useState('none'); // 'none' | 'library' | 'upload'
  const [selectedSubtitlePath, setSelectedSubtitlePath] = useState(subtitleFiles[0]?.relativePath || '');
  const [uploadedSubtitle, setUploadedSubtitle] = useState(null);
  const [subTreatment, setSubTreatment] = useState('soft'); // 'soft' (selectable) | 'burn' (hardcoded)

  // Subtitle Styling Studio State
  const [subtitleStyle, setSubtitleStyle] = useState({
    fontName: 'Arial',
    fontSize: 22,
    textColor: '#FFFFFF',
    bgPreset: 'box',
    borderStyle: 3,
    bgColor: '#000000',
    bgOpacity: 65,
    outline: 0,
    shadow: 0,
    marginV: 25,
    bold: false,
    italic: false
  });
  const [previewSampleText, setPreviewSampleText] = useState('Here is how your burned-in subtitles will appear on the video');

  // Output Config
  const [container, setContainer] = useState('mp4'); // 'mp4' | 'mkv'
  const [customName, setCustomName] = useState('');

  // Processing state
  const [isMerging, setIsMerging] = useState(false);
  const [currentProgress, setCurrentProgress] = useState({ percent: '0%', message: '' });
  const [activeJobId, setActiveJobId] = useState(null);
  const [completedResult, setCompletedResult] = useState(null);
  const [mergeError, setMergeError] = useState(null);

  const handleBgPresetChange = (presetId) => {
    const preset = BG_STYLE_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      setSubtitleStyle((prev) => ({
        ...prev,
        bgPreset: preset.id,
        borderStyle: preset.borderStyle,
        bgOpacity: preset.bgOpacity,
        outline: preset.outline,
        shadow: preset.shadow
      }));
    }
  };

  const handleStartMerge = async () => {
    setMergeError(null);
    setCompletedResult(null);

    // 1. Video is strictly required
    if (videoMode === 'library' && !selectedVideoPath) {
      return setMergeError('Please select a video file from your library or upload one.');
    }
    if (videoMode === 'upload' && !uploadedVideo) {
      return setMergeError('Please choose a video file from your computer.');
    }

    // 2. Either Audio or Subtitle must be selected
    if (audioMode === 'none' && subtitleMode === 'none') {
      return setMergeError('Please select at least an Audio track or a Subtitle file to merge with the video.');
    }

    // 3. If Audio is active, validate file selection
    if (audioMode === 'library' && !selectedAudioPath) {
      return setMergeError('Please select an audio file from your library or switch Audio to "None".');
    }
    if (audioMode === 'upload' && !uploadedAudio) {
      return setMergeError('Please choose an audio file from your computer or switch Audio to "None".');
    }

    // 4. If Subtitle is active, validate file selection
    if (subtitleMode === 'library' && !selectedSubtitlePath) {
      return setMergeError('Please select a subtitle file or switch Subtitles to "None".');
    }
    if (subtitleMode === 'upload' && !uploadedSubtitle) {
      return setMergeError('Please choose a subtitle file from your computer or switch Subtitles to "None".');
    }

    setIsMerging(true);
    setCurrentProgress({
      percent: '10%',
      message: subTreatment === 'burn' && subtitleMode !== 'none'
        ? 'Preparing video and rendering styled subtitles with FFmpeg...'
        : 'Preparing media files for FFmpeg merge...'
    });

    try {
      const formData = new FormData();
      formData.append('container', container);
      formData.append('subtitleMode', subTreatment);
      formData.append('keepOriginalAudio', String(audioMode === 'none' ? keepOriginalAudio : false));

      if (customName.trim()) {
        formData.append('outputName', customName.trim());
      }

      // Burn-in subtitle styling
      if (subtitleMode !== 'none' && subTreatment === 'burn') {
        formData.append('subtitleStyle', JSON.stringify(subtitleStyle));
      }

      // 1. Video input
      if (videoMode === 'upload' && uploadedVideo) {
        formData.append('videoFile', uploadedVideo);
      } else {
        formData.append('videoPath', selectedVideoPath);
      }

      // 2. Audio input (only if not 'none')
      if (audioMode === 'upload' && uploadedAudio) {
        formData.append('audioFile', uploadedAudio);
      } else if (audioMode === 'library' && selectedAudioPath) {
        formData.append('audioPath', selectedAudioPath);
      }

      // 3. Subtitle input (only if not 'none')
      if (subtitleMode === 'upload' && uploadedSubtitle) {
        formData.append('subtitleFile', uploadedSubtitle);
      } else if (subtitleMode === 'library' && selectedSubtitlePath) {
        formData.append('subtitlePath', selectedSubtitlePath);
      }

      // Submit merge request
      const res = await fetch('/api/merge', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to start merge');
      }

      const jobId = data.jobId;
      setActiveJobId(jobId);

      // Start SSE progress tracking for merge
      const eventSource = new EventSource(`/api/download/progress/${jobId}`);

      eventSource.onmessage = (e) => {
        try {
          const update = JSON.parse(e.data);
          setCurrentProgress({
            percent: update.percent || '50%',
            message: update.message || 'Processing streams...'
          });

          if (update.status === 'completed') {
            eventSource.close();
            setIsMerging(false);
            setCompletedResult(update);
            if (onMergeComplete) onMergeComplete();
          } else if (update.status === 'error' || update.status === 'cancelled') {
            eventSource.close();
            setIsMerging(false);
            setMergeError(update.error || 'Merge failed');
          }
        } catch (err) {
          console.error('Error parsing SSE merge progress:', err);
        }
      };

      eventSource.onerror = () => {
        // Fallback polling if SSE encounters issue
        eventSource.close();
        pollMergeStatus(jobId);
      };

    } catch (err) {
      console.error('Merge error:', err);
      setIsMerging(false);
      setMergeError(err.message || 'Merge failed to start');
    }
  };

  const pollMergeStatus = (jobId) => {
    const poller = setInterval(async () => {
      try {
        const res = await fetch(`/api/download/status/${jobId}`);
        const data = await res.json();
        if (data.ok && data.data) {
          setCurrentProgress({
            percent: data.data.percent || '60%',
            message: data.data.message || 'Merging media streams...'
          });

          if (data.data.status === 'completed') {
            clearInterval(poller);
            setIsMerging(false);
            setCompletedResult(data.data);
            if (onMergeComplete) onMergeComplete();
          } else if (data.data.status === 'error' || data.data.status === 'cancelled') {
            clearInterval(poller);
            setIsMerging(false);
            setMergeError(data.data.error || 'Merge failed');
          }
        }
      } catch (e) {
        clearInterval(poller);
        setIsMerging(false);
      }
    }, 1500);
  };

  const handleCancelMerge = async () => {
    if (!activeJobId) return;
    try {
      await fetch(`/api/merge/cancel/${activeJobId}`, { method: 'POST' });
      setIsMerging(false);
      setMergeError('Merge cancelled by user');
    } catch (e) {}
  };

  // Compute live CSS preview styling for subtitle preview box
  const previewSubtitleCss = useMemo(() => {
    const isBox = subtitleStyle.borderStyle === 3;
    const bgOpacity = (subtitleStyle.bgOpacity ?? 65) / 100;
    
    // Hex to RGBA
    const hex = (subtitleStyle.bgColor || '#000000').replace('#', '');
    const r = parseInt(hex.substring(0, 2) || '0', 16);
    const g = parseInt(hex.substring(2, 4) || '0', 16);
    const b = parseInt(hex.substring(4, 6) || '0', 16);

    const style = {
      fontFamily: subtitleStyle.fontName || 'Arial, sans-serif',
      fontSize: `${Math.max(12, Math.round(subtitleStyle.fontSize * 0.72))}px`,
      color: subtitleStyle.textColor || '#FFFFFF',
      fontWeight: subtitleStyle.bold ? '700' : '500',
      fontStyle: subtitleStyle.italic ? 'italic' : 'normal',
      lineHeight: 1.3
    };

    if (isBox) {
      style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${bgOpacity})`;
      style.padding = '4px 10px';
      style.borderRadius = '4px';
      style.boxShadow = '0 2px 8px rgba(0,0,0,0.4)';
    } else {
      style.backgroundColor = 'transparent';
      const o = subtitleStyle.outline || 2;
      style.textShadow = `
        -${o}px -${o}px 0 #000,
         ${o}px -${o}px 0 #000,
        -${o}px  ${o}px 0 #000,
         ${o}px  ${o}px 0 #000,
         0 2px 4px rgba(0,0,0,0.8)
      `;
    }

    return style;
  }, [subtitleStyle]);

  // Dynamic button label
  const mergeButtonLabel = useMemo(() => {
    if (isMerging) return 'Merging Media Streams...';
    const hasAudio = audioMode !== 'none';
    const hasSub = subtitleMode !== 'none';
    const subLabel = hasSub ? (subTreatment === 'burn' ? ' + Burned Subtitles' : ' + Subtitles') : '';

    if (hasAudio && hasSub) {
      return `Merge Video + Audio${subLabel} (${container.toUpperCase()})`;
    }
    if (hasAudio) {
      return `Merge Video + Audio (${container.toUpperCase()})`;
    }
    if (hasSub) {
      return `Merge Video${subLabel} [${keepOriginalAudio ? 'Preserve Audio' : 'Muted'}] (${container.toUpperCase()})`;
    }
    return `Merge Media (${container.toUpperCase()})`;
  }, [isMerging, audioMode, subtitleMode, subTreatment, keepOriginalAudio, container]);

  return (
    <div className="glass-panel rounded-2xl p-5 sm:p-7 border border-slate-800 shadow-2xl space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-white">Media Merger Engine</h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase">
                FFmpeg Powered
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Combine video with audio tracks or attach styled subtitles (soft or burn-in), and export to <code className="text-slate-300 font-mono">/downloads/merged_items</code>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onOpenFolder('merged_items')}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all border border-slate-700/50 shadow"
        >
          <FolderOpen className="w-4 h-4 text-amber-400" />
          <span>Open merged_items</span>
        </button>
      </div>

      {/* 3 Input Slots */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* SLOT 1: VIDEO (Required) */}
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
                <Film className="w-4 h-4 text-red-400" />
                <span>1. Video File</span>
              </div>
              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                Required
              </span>
            </div>

            {/* Mode toggle: Library vs Upload */}
            <div className="flex rounded-lg bg-slate-800/80 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setVideoMode('library')}
                className={`flex-1 py-1 rounded-md font-semibold transition-all ${
                  videoMode === 'library' ? 'bg-red-500 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                From Library ({videoFiles.length})
              </button>
              <button
                type="button"
                onClick={() => setVideoMode('upload')}
                className={`flex-1 py-1 rounded-md font-semibold transition-all ${
                  videoMode === 'upload' ? 'bg-red-500 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Upload PC File
              </button>
            </div>

            {/* Library selector */}
            {videoMode === 'library' ? (
              <div className="space-y-1">
                <select
                  value={selectedVideoPath}
                  onChange={(e) => setSelectedVideoPath(e.target.value)}
                  className="w-full bg-slate-800 text-slate-200 text-xs p-2.5 rounded-xl border border-slate-700 outline-none focus:border-red-500"
                >
                  {videoFiles.length === 0 ? (
                    <option value="">No videos in library</option>
                  ) : (
                    videoFiles.map((f) => (
                      <option key={f.relativePath || f.name} value={f.relativePath || f.name}>
                        {f.name} ({f.sizeFormatted})
                      </option>
                    ))
                  )}
                </select>
                <p className="text-[11px] text-slate-500">Pick from downloaded videos, clips, or playlists</p>
              </div>
            ) : (
              <div className="space-y-1">
                <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-700 hover:border-red-500/70 rounded-xl cursor-pointer bg-slate-850/40 hover:bg-slate-800/50 transition-all text-center">
                  <UploadCloud className="w-6 h-6 text-slate-400 mb-1" />
                  <span className="text-xs text-slate-300 font-medium truncate max-w-[200px]">
                    {uploadedVideo ? uploadedVideo.name : 'Choose video file from computer'}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-0.5">MP4, MKV, WebM, MOV, AVI</span>
                  <input
                    type="file"
                    accept="video/*,.mkv,.mp4,.webm,.avi,.mov"
                    onChange={(e) => setUploadedVideo(e.target.files[0] || null)}
                    className="hidden"
                  />
                </label>
              </div>
            )}
          </div>

          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-2 border-t border-slate-800/60">
            <CheckCircle2 className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
            <span>Base video track for the final merge</span>
          </div>
        </div>

        {/* SLOT 2: AUDIO (Optional: None | Library | Upload) */}
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
                <Music className="w-4 h-4 text-sky-400" />
                <span>2. Audio Track</span>
              </div>
              <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                audioMode === 'none'
                  ? 'bg-slate-800 text-slate-400 border-slate-700'
                  : 'bg-sky-500/10 text-sky-400 border-sky-500/20'
              }`}>
                {audioMode === 'none' ? 'None (Omit)' : 'Active'}
              </span>
            </div>

            {/* Mode toggle (None | Library | Upload) */}
            <div className="flex rounded-lg bg-slate-800/80 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setAudioMode('none')}
                className={`py-1 px-2.5 rounded-md font-semibold transition-all ${
                  audioMode === 'none' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                None
              </button>
              <button
                type="button"
                onClick={() => setAudioMode('library')}
                className={`flex-1 py-1 rounded-md font-semibold transition-all ${
                  audioMode === 'library' ? 'bg-sky-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Library ({audioFiles.length})
              </button>
              <button
                type="button"
                onClick={() => setAudioMode('upload')}
                className={`flex-1 py-1 rounded-md font-semibold transition-all ${
                  audioMode === 'upload' ? 'bg-sky-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Upload PC
              </button>
            </div>

            {/* When Audio is None: show Preserve Video Audio vs Mute option */}
            {audioMode === 'none' && (
              <div className="space-y-2 animate-fadeIn">
                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 cursor-pointer hover:bg-slate-800/90 transition-all">
                  <input
                    type="checkbox"
                    checked={keepOriginalAudio}
                    onChange={(e) => setKeepOriginalAudio(e.target.checked)}
                    className="mt-0.5 accent-sky-500 w-4 h-4 rounded cursor-pointer"
                  />
                  <div className="text-xs">
                    <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                      {keepOriginalAudio ? (
                        <Volume2 className="w-3.5 h-3.5 text-sky-400" />
                      ) : (
                        <VolumeX className="w-3.5 h-3.5 text-slate-500" />
                      )}
                      <span>Keep video's original audio</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {keepOriginalAudio
                        ? "The existing audio stream in the video will be retained."
                        : "Video will be muted / silent (-an)."}
                    </p>
                  </div>
                </label>
                <p className="text-[11px] text-slate-500 italic px-1">
                  Merge video with subtitles directly without replacing the sound.
                </p>
              </div>
            )}

            {/* Library selector */}
            {audioMode === 'library' && (
              <div className="space-y-1 animate-fadeIn">
                <select
                  value={selectedAudioPath}
                  onChange={(e) => setSelectedAudioPath(e.target.value)}
                  className="w-full bg-slate-800 text-slate-200 text-xs p-2.5 rounded-xl border border-slate-700 outline-none focus:border-sky-500"
                >
                  {audioFiles.length === 0 ? (
                    <option value="">No audio tracks in library</option>
                  ) : (
                    audioFiles.map((f) => (
                      <option key={f.relativePath || f.name} value={f.relativePath || f.name}>
                        {f.name} ({f.sizeFormatted})
                      </option>
                    ))
                  )}
                </select>
                <p className="text-[11px] text-slate-500">Pick from downloaded MP3/M4A tracks</p>
              </div>
            )}

            {/* Upload selector */}
            {audioMode === 'upload' && (
              <div className="space-y-1 animate-fadeIn">
                <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-700 hover:border-sky-500/70 rounded-xl cursor-pointer bg-slate-850/40 hover:bg-slate-800/50 transition-all text-center">
                  <UploadCloud className="w-6 h-6 text-slate-400 mb-1" />
                  <span className="text-xs text-slate-300 font-medium truncate max-w-[200px]">
                    {uploadedAudio ? uploadedAudio.name : 'Choose audio file from computer'}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-0.5">MP3, M4A, WAV, AAC, FLAC</span>
                  <input
                    type="file"
                    accept="audio/*,.mp3,.m4a,.wav,.aac,.flac,.opus"
                    onChange={(e) => setUploadedAudio(e.target.files[0] || null)}
                    className="hidden"
                  />
                </label>
              </div>
            )}
          </div>

          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-2 border-t border-slate-800/60">
            {audioMode === 'none' ? (
              <span className="text-slate-500">
                {keepOriginalAudio ? 'Audio: Keeping original video soundtrack' : 'Audio: Output will be muted'}
              </span>
            ) : (
              <span className="text-sky-400 font-medium">Audio: Custom audio track will replace original sound</span>
            )}
          </div>
        </div>

        {/* SLOT 3: SUBTITLE (Optional: None | Library | Upload) */}
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
                <Subtitles className="w-4 h-4 text-emerald-400" />
                <span>3. Subtitles</span>
              </div>
              <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                subtitleMode === 'none'
                  ? 'bg-slate-800 text-slate-400 border-slate-700'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}>
                {subtitleMode === 'none' ? 'None (Omit)' : 'Active'}
              </span>
            </div>

            {/* Mode toggle */}
            <div className="flex rounded-lg bg-slate-800/80 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setSubtitleMode('none')}
                className={`py-1 px-2.5 rounded-md font-semibold transition-all ${
                  subtitleMode === 'none' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                None
              </button>
              <button
                type="button"
                onClick={() => setSubtitleMode('library')}
                className={`flex-1 py-1 rounded-md font-semibold transition-all ${
                  subtitleMode === 'library' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Library ({subtitleFiles.length})
              </button>
              <button
                type="button"
                onClick={() => setSubtitleMode('upload')}
                className={`flex-1 py-1 rounded-md font-semibold transition-all ${
                  subtitleMode === 'upload' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Upload PC
              </button>
            </div>

            {/* When Subtitle is None */}
            {subtitleMode === 'none' && (
              <div className="p-3 text-center text-xs text-slate-500 italic bg-slate-950/40 rounded-xl animate-fadeIn">
                No subtitles selected. Select Library or Upload to add subtitles or burn them in.
              </div>
            )}

            {/* Library selector */}
            {subtitleMode === 'library' && (
              <div className="space-y-1 animate-fadeIn">
                <select
                  value={selectedSubtitlePath}
                  onChange={(e) => setSelectedSubtitlePath(e.target.value)}
                  className="w-full bg-slate-800 text-slate-200 text-xs p-2.5 rounded-xl border border-slate-700 outline-none focus:border-emerald-500"
                >
                  {subtitleFiles.length === 0 ? (
                    <option value="">No subtitles in library</option>
                  ) : (
                    subtitleFiles.map((f) => (
                      <option key={f.relativePath || f.name} value={f.relativePath || f.name}>
                        {f.name}
                      </option>
                    ))
                  )}
                </select>
                <p className="text-[11px] text-slate-500">Pick from downloaded .srt / .vtt subtitles</p>
              </div>
            )}

            {/* Upload selector */}
            {subtitleMode === 'upload' && (
              <div className="space-y-1 animate-fadeIn">
                <label className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-slate-700 hover:border-emerald-500/70 rounded-xl cursor-pointer bg-slate-850/40 hover:bg-slate-800/50 transition-all text-center">
                  <UploadCloud className="w-5 h-5 text-slate-400 mb-1" />
                  <span className="text-xs text-slate-300 font-medium truncate max-w-[200px]">
                    {uploadedSubtitle ? uploadedSubtitle.name : 'Choose .srt, .vtt, or .ass file'}
                  </span>
                  <input
                    type="file"
                    accept=".srt,.vtt,.ass"
                    onChange={(e) => setUploadedSubtitle(e.target.files[0] || null)}
                    className="hidden"
                  />
                </label>
              </div>
            )}

            {/* Subtitle treatment mode (soft vs burn) */}
            {subtitleMode !== 'none' && (
              <div className="pt-2 border-t border-slate-800 space-y-2 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                    Rendering Method:
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setSubTreatment('soft')}
                    className={`p-2 rounded-xl border text-left transition-all ${
                      subTreatment === 'soft'
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300'
                        : 'bg-slate-850/50 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1.5">
                      <Subtitles className="w-3.5 h-3.5" />
                      <span>Soft Subtitle</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">Selectable track in media players</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSubTreatment('burn')}
                    className={`p-2 rounded-xl border text-left transition-all ${
                      subTreatment === 'burn'
                        ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-orange-500 text-orange-300 shadow'
                        : 'bg-slate-850/50 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-orange-400" />
                      <span>Burn-in Directly</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">Hardcoded permanently on video</p>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-2 border-t border-slate-800/60">
            {subtitleMode === 'none' ? (
              <span className="text-slate-500">Subtitles: None</span>
            ) : subTreatment === 'burn' ? (
              <span className="text-orange-400 font-medium">Subtitles: Burned directly with custom styling</span>
            ) : (
              <span className="text-emerald-400 font-medium">Subtitles: Soft muxed track ({container === 'mkv' ? 'SRT' : 'mov_text'})</span>
            )}
          </div>
        </div>
      </div>

      {/* SUBTITLE STYLING STUDIO & LIVE 16:9 PREVIEW (When Subtitle Burn-In is selected) */}
      {subtitleMode !== 'none' && subTreatment === 'burn' && (
        <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900/95 to-slate-950 border border-orange-500/30 shadow-2xl space-y-5 animate-fadeIn">
          {/* Studio Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20">
                <Palette className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-white">Subtitle Styling Studio</h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500/20 text-orange-300 border border-orange-500/30">
                    Live Preview
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Customize the exact font, color, background box, and position burned onto the video frames
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Sample Text:</span>
              <input
                type="text"
                value={previewSampleText}
                onChange={(e) => setPreviewSampleText(e.target.value)}
                placeholder="Type sample subtitle..."
                className="bg-slate-800 text-slate-200 text-xs px-2.5 py-1 rounded-lg border border-slate-700 outline-none focus:border-orange-500 w-48 sm:w-64"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* LEFT COLUMN: CONTROLS (7 Cols) */}
            <div className="lg:col-span-7 space-y-4">
              {/* Row 1: Font Family & Size & Style (Bold/Italic) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Font Family */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                    <Type className="w-3.5 h-3.5 text-slate-400" />
                    <span>Font Family</span>
                  </label>
                  <select
                    value={subtitleStyle.fontName}
                    onChange={(e) => setSubtitleStyle({ ...subtitleStyle, fontName: e.target.value })}
                    className="w-full bg-slate-800 text-slate-200 text-xs p-2 rounded-xl border border-slate-700 outline-none focus:border-orange-500"
                  >
                    {FONT_OPTIONS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Font Size */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
                    <span>Font Size</span>
                    <span className="font-mono text-orange-400">{subtitleStyle.fontSize}pt</span>
                  </label>
                  <div className="flex items-center gap-1">
                    {[18, 22, 26, 32].map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setSubtitleStyle({ ...subtitleStyle, fontSize: sz })}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          subtitleStyle.fontSize === sz
                            ? 'bg-orange-500 text-slate-950 shadow'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bold & Italic */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400">Text Style</label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setSubtitleStyle({ ...subtitleStyle, bold: !subtitleStyle.bold })}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all ${
                        subtitleStyle.bold
                          ? 'bg-orange-500 text-slate-950 shadow'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      B (Bold)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubtitleStyle({ ...subtitleStyle, italic: !subtitleStyle.italic })}
                      className={`flex-1 py-1.5 rounded-lg text-xs italic font-serif font-bold transition-all ${
                        subtitleStyle.italic
                          ? 'bg-orange-500 text-slate-950 shadow'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      I (Italic)
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 2: Text Color Swatches + Custom Picker */}
              <div className="p-3 rounded-xl bg-slate-850/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-orange-400" />
                    <span>Subtitle Text Color</span>
                  </label>
                  <span className="font-mono text-xs text-slate-400 uppercase">{subtitleStyle.textColor}</span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {PRESET_COLORS.map((col) => {
                    const isSelected = subtitleStyle.textColor.toUpperCase() === col.hex.toUpperCase();
                    return (
                      <button
                        key={col.hex}
                        type="button"
                        onClick={() => setSubtitleStyle({ ...subtitleStyle, textColor: col.hex })}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                          isSelected
                            ? 'border-orange-500 bg-orange-500/10 text-white shadow-sm'
                            : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/40 shadow-inner flex-shrink-0"
                          style={{ backgroundColor: col.hex }}
                        />
                        <span>{col.label}</span>
                      </button>
                    );
                  })}

                  {/* Custom color picker */}
                  <label className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border border-slate-700 bg-slate-800 text-slate-300 hover:text-white cursor-pointer ml-auto">
                    <span>Custom</span>
                    <input
                      type="color"
                      value={subtitleStyle.textColor}
                      onChange={(e) => setSubtitleStyle({ ...subtitleStyle, textColor: e.target.value })}
                      className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                    />
                  </label>
                </div>
              </div>

              {/* Row 3: Background Box & Contrast Style */}
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-orange-400" />
                    <span>Background & Contrast Style</span>
                  </span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {BG_STYLE_PRESETS.map((pst) => {
                    const isSelected = subtitleStyle.bgPreset === pst.id;
                    return (
                      <button
                        key={pst.id}
                        type="button"
                        onClick={() => handleBgPresetChange(pst.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'bg-orange-500/10 border-orange-500 text-white shadow-sm'
                            : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-200">{pst.name}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-orange-400" />}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{pst.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Row 4: Background Opacity Slider (if box style) & Bottom Margin */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Opacity slider */}
                {subtitleStyle.borderStyle === 3 ? (
                  <div className="p-3 rounded-xl bg-slate-850/60 border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-medium">Box Opacity</span>
                      <span className="font-mono text-orange-400 font-bold">{subtitleStyle.bgOpacity}%</span>
                    </div>
                    <input
                      type="range"
                      min="20"
                      max="100"
                      step="5"
                      value={subtitleStyle.bgOpacity}
                      onChange={(e) => setSubtitleStyle({ ...subtitleStyle, bgOpacity: parseInt(e.target.value) })}
                      className="w-full accent-orange-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>Translucent (20%)</span>
                      <span>Solid (100%)</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-slate-850/60 border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-medium">Outline Thickness</span>
                      <span className="font-mono text-orange-400 font-bold">{subtitleStyle.outline}px</span>
                    </div>
                    <div className="flex gap-1.5">
                      {[1, 2, 3, 4].map((thick) => (
                        <button
                          key={thick}
                          type="button"
                          onClick={() => setSubtitleStyle({ ...subtitleStyle, outline: thick })}
                          className={`flex-1 py-1 rounded text-xs font-bold ${
                            subtitleStyle.outline === thick
                              ? 'bg-orange-500 text-slate-950'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {thick}px
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Bottom Margin / Distance */}
                <div className="p-3 rounded-xl bg-slate-850/60 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">Bottom Position</span>
                    <span className="font-mono text-orange-400 font-bold">{subtitleStyle.marginV}px</span>
                  </div>
                  <div className="flex gap-1.5">
                    {[
                      { label: 'Low (10px)', val: 10 },
                      { label: 'Standard (25px)', val: 25 },
                      { label: 'Raised (45px)', val: 45 }
                    ].map((pos) => (
                      <button
                        key={pos.val}
                        type="button"
                        onClick={() => setSubtitleStyle({ ...subtitleStyle, marginV: pos.val })}
                        className={`flex-1 py-1 rounded text-[11px] font-bold ${
                          subtitleStyle.marginV === pos.val
                            ? 'bg-orange-500 text-slate-950'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {pos.label.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500 text-center">Distance from bottom video frame</p>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: 16:9 LIVE PREVIEW (5 Cols) */}
            <div className="lg:col-span-5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-300 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-orange-400" />
                  <span>16:9 Cinema Live Preview</span>
                </span>
                <span className="text-[10px] font-mono text-slate-500">Real-Time Simulation</span>
              </div>

              {/* 16:9 Video Box */}
              <div className="relative w-full aspect-video rounded-2xl overflow-hidden border-2 border-slate-700 bg-slate-950 shadow-2xl flex flex-col justify-between p-3 select-none">
                {/* Cinema scene simulated background */}
                <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 via-slate-900 to-indigo-950/60 opacity-90" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(30,41,59,0.5)_0%,transparent_70%)]" />

                {/* Subtle video player UI overlay */}
                <div className="relative z-10 flex items-center justify-between text-[10px] text-slate-400">
                  <span className="flex items-center gap-1 font-semibold text-slate-300">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span>PREVIEW 1080p</span>
                  </span>
                  <span className="font-mono text-slate-500">01:42 / 04:15</span>
                </div>

                {/* Center playback indicator */}
                <div className="relative z-10 mx-auto my-auto p-3 rounded-full bg-black/40 border border-white/10 text-white/40">
                  <Play className="w-5 h-5 ml-0.5 fill-current" />
                </div>

                {/* LIVE SUBTITLE CONTAINER AT BOTTOM */}
                <div
                  className="relative z-10 w-full flex justify-center text-center transition-all duration-150 px-2"
                  style={{
                    marginBottom: `${Math.max(4, Math.min(30, Math.round(subtitleStyle.marginV * 0.5)))}px`
                  }}
                >
                  <span
                    style={previewSubtitleCss}
                    className="inline-block max-w-[92%] transition-all duration-150"
                  >
                    {previewSampleText || 'Your subtitle line will look like this'}
                  </span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                <span>FFmpeg filter:</span>
                <code className="text-orange-300 font-mono text-[10px]">
                  force_style='FontName={subtitleStyle.fontName},FontSize={subtitleStyle.fontSize}...'
                </code>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Output Configuration Bar */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        {/* Container format */}
        <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
          <span>Output Container:</span>
          {['mp4', 'mkv'].map((ext) => (
            <button
              key={ext}
              type="button"
              onClick={() => setContainer(ext)}
              className={`px-3 py-1 rounded-lg text-xs font-bold uppercase transition-all ${
                container === ext
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {ext}
            </button>
          ))}
        </div>

        {/* Custom file name */}
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <span className="text-xs text-slate-400 whitespace-nowrap">Output Name:</span>
          <input
            type="text"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="e.g. final_movie (optional)"
            className="w-full bg-slate-800 text-slate-200 text-xs px-3 py-1.5 rounded-xl border border-slate-700 outline-none focus:border-amber-500"
          />
        </div>

        {/* Target destination folder */}
        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
          <HardDrive className="w-3.5 h-3.5 text-slate-500" />
          <span>Saves to: <strong className="text-amber-400">/downloads/merged_items</strong></span>
        </div>
      </div>

      {/* Error alert */}
      {mergeError && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{mergeError}</span>
          </div>
          <button onClick={() => setMergeError(null)} className="text-red-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Live Merge Progress Bar */}
      {isMerging && (
        <div className="p-5 rounded-xl bg-slate-900/90 border border-amber-500/30 space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between text-xs text-slate-200">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
              <span className="font-semibold text-amber-300">{currentProgress.message}</span>
            </div>
            <span className="font-mono font-bold text-amber-400">{currentProgress.percent}</span>
          </div>

          <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 h-2.5 rounded-full transition-all duration-300"
              style={{ width: currentProgress.percent }}
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleCancelMerge}
              className="px-3 py-1 text-xs text-slate-400 hover:text-red-400 rounded-lg transition-colors"
            >
              Cancel Merge
            </button>
          </div>
        </div>
      )}

      {/* Completed Success Card */}
      {completedResult && (
        <div className="p-5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-3 animate-fadeIn">
          <div className="flex items-center gap-2.5 text-emerald-400">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-bold text-white">Media Merge Completed Successfully!</h4>
              <p className="text-xs text-emerald-300/90 mt-0.5">
                Output saved to <code className="font-mono text-white">/downloads/merged_items/{completedResult.fileName}</code> ({completedResult.fileSizeFormatted})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => onOpenFolder('merged_items')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all"
            >
              <FolderOpen className="w-4 h-4 text-amber-400" />
              <span>Open in Explorer</span>
            </button>

            <button
              type="button"
              onClick={() => onDownloadFile(completedResult.relativePath || completedResult.fileName)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Save to Browser</span>
            </button>

            <button
              type="button"
              onClick={() => setCompletedResult(null)}
              className="text-xs text-slate-400 hover:text-white px-2 py-1 ml-auto"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Action Button */}
      <div>
        <button
          type="button"
          onClick={handleStartMerge}
          disabled={isMerging}
          className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-gradient-to-r from-amber-600 via-rose-600 to-amber-600 hover:from-amber-500 hover:to-rose-500 disabled:opacity-50 text-white font-bold text-base rounded-2xl shadow-xl shadow-amber-600/20 transition-all active:scale-[0.99]"
        >
          {isMerging ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Merging Media Streams...</span>
            </>
          ) : (
            <>
              <Layers className="w-5 h-5" />
              <span>{mergeButtonLabel}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
