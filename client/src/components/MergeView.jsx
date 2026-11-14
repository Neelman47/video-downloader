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
  FileText
} from 'lucide-react';

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

  // Video Slot State
  const [videoMode, setVideoMode] = useState('library'); // 'library' | 'upload'
  const [selectedVideoPath, setSelectedVideoPath] = useState(videoFiles[0]?.relativePath || '');
  const [uploadedVideo, setUploadedVideo] = useState(null);

  // Audio Slot State
  const [audioMode, setAudioMode] = useState('library'); // 'library' | 'upload'
  const [selectedAudioPath, setSelectedAudioPath] = useState(audioFiles[0]?.relativePath || '');
  const [uploadedAudio, setUploadedAudio] = useState(null);

  // Subtitle Slot State (Optional)
  const [subtitleMode, setSubtitleMode] = useState('none'); // 'none' | 'library' | 'upload'
  const [selectedSubtitlePath, setSelectedSubtitlePath] = useState(subtitleFiles[0]?.relativePath || '');
  const [uploadedSubtitle, setUploadedSubtitle] = useState(null);
  const [subTreatment, setSubTreatment] = useState('soft'); // 'soft' (selectable) | 'burn' (hardcoded)

  // Output Config
  const [container, setContainer] = useState('mp4'); // 'mp4' | 'mkv'
  const [customName, setCustomName] = useState('');

  // Processing state
  const [isMerging, setIsMerging] = useState(false);
  const [currentProgress, setCurrentProgress] = useState({ percent: '0%', message: '' });
  const [activeJobId, setActiveJobId] = useState(null);
  const [completedResult, setCompletedResult] = useState(null);
  const [mergeError, setMergeError] = useState(null);

  const handleStartMerge = async () => {
    setMergeError(null);
    setCompletedResult(null);

    // Validation
    if (videoMode === 'library' && !selectedVideoPath) {
      return setMergeError('Please select a video file from your library or upload one.');
    }
    if (videoMode === 'upload' && !uploadedVideo) {
      return setMergeError('Please select a video file from your computer.');
    }
    if (audioMode === 'library' && !selectedAudioPath) {
      return setMergeError('Please select an audio file from your library or upload one.');
    }
    if (audioMode === 'upload' && !uploadedAudio) {
      return setMergeError('Please select an audio file from your computer.');
    }
    if (subtitleMode === 'library' && !selectedSubtitlePath) {
      return setMergeError('Please select a subtitle file or switch subtitle to "None".');
    }
    if (subtitleMode === 'upload' && !uploadedSubtitle) {
      return setMergeError('Please choose a subtitle file from your computer or switch to "None".');
    }

    setIsMerging(true);
    setCurrentProgress({ percent: '10%', message: 'Preparing media files for FFmpeg merge...' });

    try {
      const formData = new FormData();
      formData.append('container', container);
      formData.append('subtitleMode', subTreatment);
      if (customName.trim()) {
        formData.append('outputName', customName.trim());
      }

      // 1. Video input
      if (videoMode === 'upload' && uploadedVideo) {
        formData.append('videoFile', uploadedVideo);
      } else {
        formData.append('videoPath', selectedVideoPath);
      }

      // 2. Audio input
      if (audioMode === 'upload' && uploadedAudio) {
        formData.append('audioFile', uploadedAudio);
      } else {
        formData.append('audioPath', selectedAudioPath);
      }

      // 3. Subtitle input
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
              Combine video with any audio dub track, optionally embed or burn subtitles, and export to <code className="text-slate-300 font-mono">/downloads/merged_items</code>
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
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
              <Film className="w-4 h-4 text-red-400" />
              <span>1. Video File</span>
            </div>
            <span className="text-[10px] font-bold uppercase px-1.5 py-0.2 rounded bg-red-500/10 text-red-400 border border-red-500/20">
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
              <p className="text-[11px] text-slate-500">Pick from videos, clips, or playlists</p>
            </div>
          ) : (
            <div className="space-y-1">
              <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-700 hover:border-red-500/70 rounded-xl cursor-pointer bg-slate-850/40 hover:bg-slate-800/50 transition-all text-center">
                <UploadCloud className="w-6 h-6 text-slate-400 mb-1" />
                <span className="text-xs text-slate-300 font-medium">
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

        {/* SLOT 2: AUDIO (Required) */}
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
              <Music className="w-4 h-4 text-sky-400" />
              <span>2. Audio File</span>
            </div>
            <span className="text-[10px] font-bold uppercase px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
              Required
            </span>
          </div>

          {/* Mode toggle */}
          <div className="flex rounded-lg bg-slate-800/80 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setAudioMode('library')}
              className={`flex-1 py-1 rounded-md font-semibold transition-all ${
                audioMode === 'library' ? 'bg-sky-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              From Library ({audioFiles.length})
            </button>
            <button
              type="button"
              onClick={() => setAudioMode('upload')}
              className={`flex-1 py-1 rounded-md font-semibold transition-all ${
                audioMode === 'upload' ? 'bg-sky-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Upload PC File
            </button>
          </div>

          {/* Library selector */}
          {audioMode === 'library' ? (
            <div className="space-y-1">
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
          ) : (
            <div className="space-y-1">
              <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-700 hover:border-sky-500/70 rounded-xl cursor-pointer bg-slate-850/40 hover:bg-slate-800/50 transition-all text-center">
                <UploadCloud className="w-6 h-6 text-slate-400 mb-1" />
                <span className="text-xs text-slate-300 font-medium">
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

        {/* SLOT 3: SUBTITLE (Optional) */}
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
              <Subtitles className="w-4 h-4 text-emerald-400" />
              <span>3. Subtitles</span>
            </div>
            <span className="text-[10px] font-bold uppercase px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Optional
            </span>
          </div>

          {/* Mode toggle */}
          <div className="flex rounded-lg bg-slate-800/80 p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => setSubtitleMode('none')}
              className={`flex-1 py-1 rounded-md font-semibold transition-all ${
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
              Upload
            </button>
          </div>

          {/* Library selector */}
          {subtitleMode === 'library' && (
            <div className="space-y-1">
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
            </div>
          )}

          {/* Upload selector */}
          {subtitleMode === 'upload' && (
            <div className="space-y-1">
              <label className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-slate-700 hover:border-emerald-500/70 rounded-xl cursor-pointer bg-slate-850/40 hover:bg-slate-800/50 transition-all text-center">
                <UploadCloud className="w-5 h-5 text-slate-400 mb-1" />
                <span className="text-xs text-slate-300 font-medium truncate max-w-[200px]">
                  {uploadedSubtitle ? uploadedSubtitle.name : 'Choose .srt or .vtt file'}
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
            <div className="pt-2 border-t border-slate-800 space-y-1">
              <label className="text-[11px] text-slate-400 font-medium">Subtitle Rendering:</label>
              <div className="flex gap-2 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                  <input
                    type="radio"
                    name="subTreatment"
                    value="soft"
                    checked={subTreatment === 'soft'}
                    onChange={() => setSubTreatment('soft')}
                    className="accent-emerald-500"
                  />
                  <span>Soft (Selectable Track)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                  <input
                    type="radio"
                    name="subTreatment"
                    value="burn"
                    checked={subTreatment === 'burn'}
                    onChange={() => setSubTreatment('burn')}
                    className="accent-emerald-500"
                  />
                  <span>Burn-in</span>
                </label>
              </div>
            </div>
          )}

          {subtitleMode === 'none' && (
            <div className="p-3 text-center text-xs text-slate-500 italic bg-slate-950/40 rounded-xl">
              No subtitles will be added. Video & audio will be merged.
            </div>
          )}
        </div>
      </div>

      {/* Output Configuration Bar */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        {/* Container format */}
        <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
          <span>Output Format:</span>
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
          <span className="text-xs text-slate-400 whitespace-nowrap">Output Name (Optional):</span>
          <input
            type="text"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="e.g. final_movie"
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
              className="bg-gradient-to-r from-amber-500 to-rose-500 h-2.5 rounded-full transition-all duration-300"
              style={{ width: currentProgress.percent }}
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleCancelMerge}
              className="px-3 py-1 text-xs text-slate-400 hover:text-red-400 rounded-lg"
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
              <span>
                Merge Video + Audio {subtitleMode !== 'none' ? '+ Subtitles' : ''} ({container.toUpperCase()})
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
