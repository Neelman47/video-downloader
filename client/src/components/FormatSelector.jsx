import React, { useState } from 'react';
import {
  Film,
  Music,
  Video,
  Check,
  Sparkles,
  Globe,
  HardDrive,
  Download,
  Scissors,
  Subtitles as SubtitlesIcon,
  Clock,
  Sliders,
  CheckCircle2,
  FileText,
  Loader2,
  Zap
} from 'lucide-react';

function secondsToTimeStr(sec) {
  if (isNaN(sec) || sec < 0) return '00:00';
  const s = Math.floor(sec % 60);
  const m = Math.floor((sec / 60) % 60);
  const h = Math.floor(sec / 3600);
  const pad = (n) => String(n).padStart(2, '0');
  if (h > 0) {
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }
  return `${pad(m)}:${pad(s)}`;
}

function timeStrToSeconds(str) {
  if (!str) return 0;
  const parts = str.trim().split(':').map((p) => parseFloat(p) || 0);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return parseFloat(str) || 0;
}

export default function FormatSelector({ video, onDownload, downloading, onSubtitleDownloaded }) {
  if (!video) return null;

  const totalDuration = video.duration || 0;

  // Mode: 'both' | 'video_only' | 'audio_only'
  const [mode, setMode] = useState('both');

  // Selected video format itag
  const [selectedVideoItag, setSelectedVideoItag] = useState(
    video.availableVideoQualities?.[0]?.itag || ''
  );

  // Selected audio language name
  const [selectedLanguageName, setSelectedLanguageName] = useState(
    video.audioLanguages?.[0]?.languageName || 'Default / Original Audio'
  );

  // Selected audio track itag
  const [selectedAudioItag, setSelectedAudioItag] = useState(
    video.audioLanguages?.[0]?.bestItag || ''
  );

  // Container format (mp4 / mkv for video, mp3 / m4a for audio)
  const [container, setContainer] = useState('mp4');

  // Trimming / Clipping state
  const [enableTrim, setEnableTrim] = useState(false);
  const [trimStartSec, setTrimStartSec] = useState(0);
  const [trimEndSec, setTrimEndSec] = useState(totalDuration || 60);

  // Subtitle state
  const [selectedSubLang, setSelectedSubLang] = useState(
    video.subtitles?.[0]?.languageCode || 'en'
  );
  const [subFormat, setSubFormat] = useState('srt');
  const [downloadingSub, setDownloadingSub] = useState(false);
  const [subSuccessMsg, setSubSuccessMsg] = useState(null);

  // Turbo Multi-Threaded Chunk Accelerator toggle
  const [fastDownload, setFastDownload] = useState(true);

  // When language changes, update the selectedAudioItag
  const handleLanguageChange = (langName) => {
    setSelectedLanguageName(langName);
    const langObj = video.audioLanguages.find((l) => l.languageName === langName);
    if (langObj) {
      setSelectedAudioItag(langObj.bestItag);
    }
  };

  const handleStartSecChange = (val) => {
    const num = Math.max(0, Math.min(val, trimEndSec - 1));
    setTrimStartSec(num);
  };

  const handleEndSecChange = (val) => {
    const num = Math.min(totalDuration || 99999, Math.max(val, trimStartSec + 1));
    setTrimEndSec(num);
  };

  const handleStartDownload = () => {
    const downloadUrl = video.webpageUrl || (video.id ? `https://www.youtube.com/watch?v=${video.id}` : '');
    const currentLangObj = video.audioLanguages?.find((l) => l.languageName === selectedLanguageName);

    onDownload({
      url: downloadUrl,
      mode,
      videoItag: selectedVideoItag,
      audioItag: selectedAudioItag,
      audioLanguage: selectedLanguageName,
      audioTrackId: currentLangObj?.trackId || null,
      container: mode === 'audio_only' ? (container === 'mp3' ? 'mp3' : 'm4a') : container,
      title: video.title,
      trimStart: enableTrim ? secondsToTimeStr(trimStartSec) : null,
      trimEnd: enableTrim ? secondsToTimeStr(trimEndSec) : null,
      fastDownload
    });
  };

  // Subtitle download handler
  const handleDownloadSubtitle = async () => {
    if (!selectedSubLang) return;
    setDownloadingSub(true);
    setSubSuccessMsg(null);
    try {
      const res = await fetch('/api/download/subtitle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: video.webpageUrl || `https://www.youtube.com/watch?v=${video.id}`,
          languageCode: selectedSubLang,
          format: subFormat,
          title: video.title,
          videoId: video.id
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to download subtitle');
      }
      setSubSuccessMsg(`Downloaded to /downloads/subtitles/${data.data.fileName}`);
      if (onSubtitleDownloaded) onSubtitleDownloaded();
      setTimeout(() => setSubSuccessMsg(null), 5000);
    } catch (err) {
      alert(`Error downloading subtitle: ${err.message}`);
    } finally {
      setDownloadingSub(false);
    }
  };

  const currentVideoObj = video.availableVideoQualities?.find((v) => v.itag === selectedVideoItag) || video.availableVideoQualities?.[0];
  const currentLangObj = video.audioLanguages?.find((l) => l.languageName === selectedLanguageName) || video.audioLanguages?.[0];

  const clipDuration = Math.max(0, trimEndSec - trimStartSec);

  return (
    <div className="glass-panel rounded-2xl p-5 sm:p-6 border border-slate-800 shadow-2xl space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-red-500" />
            <span>Customize Download</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Select video quality, audio language, download mode, clipping segment, or subtitles
          </p>
        </div>
      </div>

      {/* STEP 1: Download Mode Selector */}
      <div>
        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
          Step 1: Choose Download Mode
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* Mode: Both */}
          <button
            type="button"
            onClick={() => {
              setMode('both');
              if (container === 'mp3') setContainer('mp4');
            }}
            className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
              mode === 'both'
                ? 'bg-red-500/10 border-red-500 text-white ring-2 ring-red-500/20'
                : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800/60 hover:border-slate-700'
            }`}
          >
            <div className={`p-2 rounded-lg ${mode === 'both' ? 'bg-red-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
              <Film className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm">Video + Audio</span>
                {mode === 'both' && <CheckCircle2 className="w-4 h-4 text-red-400" />}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Full video with selected language</p>
            </div>
          </button>

          {/* Mode: Video Only */}
          <button
            type="button"
            onClick={() => {
              setMode('video_only');
              if (container === 'mp3') setContainer('mp4');
            }}
            className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
              mode === 'video_only'
                ? 'bg-red-500/10 border-red-500 text-white ring-2 ring-red-500/20'
                : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800/60 hover:border-slate-700'
            }`}
          >
            <div className={`p-2 rounded-lg ${mode === 'video_only' ? 'bg-red-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
              <Video className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm">Video Only</span>
                {mode === 'video_only' && <CheckCircle2 className="w-4 h-4 text-red-400" />}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Silent video stream only</p>
            </div>
          </button>

          {/* Mode: Audio Only */}
          <button
            type="button"
            onClick={() => {
              setMode('audio_only');
              setContainer('mp3');
            }}
            className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
              mode === 'audio_only'
                ? 'bg-red-500/10 border-red-500 text-white ring-2 ring-red-500/20'
                : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800/60 hover:border-slate-700'
            }`}
          >
            <div className={`p-2 rounded-lg ${mode === 'audio_only' ? 'bg-red-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
              <Music className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm">Audio Only</span>
                {mode === 'audio_only' && <CheckCircle2 className="w-4 h-4 text-red-400" />}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">MP3 or M4A music/speech</p>
            </div>
          </button>
        </div>
      </div>

      {/* STEP 2: Video Quality & Audio Language Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Video Quality */}
        {mode !== 'audio_only' && (
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Video className="w-4 h-4 text-red-400" />
                <span>Video Quality ({video.availableVideoQualities?.length || 0} Available)</span>
              </span>
              <span className="text-[11px] font-normal text-slate-400 lowercase">
                sorted highest to lowest
              </span>
            </label>

            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {video.availableVideoQualities?.map((vq) => {
                const isSelected = vq.itag === selectedVideoItag;
                return (
                  <button
                    key={vq.itag}
                    type="button"
                    onClick={() => setSelectedVideoItag(vq.itag)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-left text-xs transition-all ${
                      isSelected
                        ? 'bg-slate-800/90 border-red-500/80 text-white shadow-sm ring-1 ring-red-500/30'
                        : 'bg-slate-900/50 border-slate-800/80 text-slate-300 hover:bg-slate-850 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        isSelected ? 'border-red-500 bg-red-500 text-white' : 'border-slate-600'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span className="font-semibold text-slate-200">
                        {vq.displayLabel}
                      </span>
                      {vq.isAvc && (
                        <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] text-slate-400">
                          MP4 (H.264)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-slate-400">
                      <span>{vq.approxSizeFormatted}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Audio Language */}
        {mode !== 'video_only' && (
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-sky-400" />
                <span>Audio Language ({video.audioLanguages?.length || 1} Available)</span>
              </span>
              {video.hasMultipleAudioLanguages && (
                <span className="text-[10px] font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20">
                  Multi-Language Track
                </span>
              )}
            </label>

            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {video.audioLanguages?.map((lang) => {
                const isSelected = lang.languageName === selectedLanguageName;
                return (
                  <button
                    key={lang.languageName}
                    type="button"
                    onClick={() => handleLanguageChange(lang.languageName)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-left text-xs transition-all ${
                      isSelected
                        ? 'bg-slate-800/90 border-sky-500/80 text-white shadow-sm ring-1 ring-sky-500/30'
                        : 'bg-slate-900/50 border-slate-800/80 text-slate-300 hover:bg-slate-850 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        isSelected ? 'border-sky-500 bg-sky-500 text-white' : 'border-slate-600'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span className="font-semibold text-slate-200">
                        {lang.languageName}
                      </span>
                      {lang.isDefault && (
                        <span className="px-1.5 py-0.2 rounded bg-sky-500/10 text-[10px] text-sky-300 border border-sky-500/20">
                          Original
                        </span>
                      )}
                    </div>

                    <div className="text-slate-400 text-[11px]">
                      <span>{lang.bestBitrate}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* FEATURE 3: Video Trimming / Clipping Section */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setEnableTrim(!enableTrim)}
            className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-200 hover:text-white"
          >
            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
              enableTrim ? 'bg-amber-500 border-amber-500 text-slate-950' : 'border-slate-600 bg-slate-800'
            }`}>
              {enableTrim && <Check className="w-3 h-3 stroke-[3]" />}
            </div>
            <Scissors className="w-4 h-4 text-amber-400" />
            <span>Trim / Clip Video (Download specific portion)</span>
          </button>

          {enableTrim && (
            <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              Saves to: /downloads/clips
            </span>
          )}
        </div>

        {enableTrim && (
          <div className="pt-3 border-t border-slate-800/80 space-y-4 animate-fadeIn">
            {/* Sliders and Range Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Start Time */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-slate-300 font-medium">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-400" /> Start Time:
                  </span>
                  <span className="font-mono font-bold text-amber-300">{secondsToTimeStr(trimStartSec)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={totalDuration || 60}
                  value={trimStartSec}
                  onChange={(e) => handleStartSecChange(parseFloat(e.target.value))}
                  className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* End Time */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-slate-300 font-medium">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-400" /> End Time:
                  </span>
                  <span className="font-mono font-bold text-amber-300">{secondsToTimeStr(trimEndSec)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={totalDuration || 60}
                  value={trimEndSec}
                  onChange={(e) => handleEndSecChange(parseFloat(e.target.value))}
                  className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            {/* Quick Trim Presets & Duration Summary */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Presets:</span>
                <button
                  type="button"
                  onClick={() => { setTrimStartSec(0); setTrimEndSec(Math.min(30, totalDuration)); }}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  First 30s
                </button>
                <button
                  type="button"
                  onClick={() => { setTrimStartSec(0); setTrimEndSec(Math.min(60, totalDuration)); }}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  First 60s
                </button>
                <button
                  type="button"
                  onClick={() => { setTrimStartSec(0); setTrimEndSec(totalDuration); }}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Full Video
                </button>
              </div>

              <div className="font-mono text-slate-300 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
                Segment: <span className="text-amber-400 font-bold">{secondsToTimeStr(trimStartSec)}</span> - <span className="text-amber-400 font-bold">{secondsToTimeStr(trimEndSec)}</span> (Clip Length: {secondsToTimeStr(clipDuration)})
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FEATURE 1: Subtitles / Closed Captions Section */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SubtitlesIcon className="w-4 h-4 text-emerald-400" />
            <span className="text-xs sm:text-sm font-bold text-slate-200">
              Subtitles / Closed Captions ({video.subtitles?.length || 0} Available)
            </span>
          </div>

          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            Saves to: /downloads/subtitles
          </span>
        </div>

        {video.hasSubtitles ? (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800/80">
            <select
              value={selectedSubLang}
              onChange={(e) => setSelectedSubLang(e.target.value)}
              className="bg-slate-800 text-slate-200 text-xs px-3 py-2 rounded-xl border border-slate-700 outline-none focus:border-emerald-500 min-w-[200px]"
            >
              {video.subtitles?.map((s) => (
                <option key={`${s.languageCode}_${s.languageName}`} value={s.languageCode}>
                  {s.languageName} {s.isAutoGenerated ? '(Auto-generated)' : ''}
                </option>
              ))}
            </select>

            {/* Subtitle format toggle (.srt vs .vtt) */}
            <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded-xl border border-slate-700">
              <button
                type="button"
                onClick={() => setSubFormat('srt')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                  subFormat === 'srt' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                .SRT
              </button>
              <button
                type="button"
                onClick={() => setSubFormat('vtt')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                  subFormat === 'vtt' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                .VTT
              </button>
            </div>

            <button
              type="button"
              onClick={handleDownloadSubtitle}
              disabled={downloadingSub}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow transition-all"
            >
              {downloadingSub ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Downloading...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Subtitles</span>
                </>
              )}
            </button>

            {subSuccessMsg && (
              <span className="text-xs text-emerald-400 font-mono animate-fadeIn">
                ✓ {subSuccessMsg}
              </span>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic pt-1">
            No closed captions or subtitles available for this video.
          </p>
        )}
      </div>

      {/* Output Format Container Selection */}
      <div className="pt-2 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
          <span>Output Container:</span>
          {mode === 'audio_only' ? (
            <div className="flex items-center gap-1.5">
              {['mp3', 'm4a'].map((ext) => (
                <button
                  key={ext}
                  type="button"
                  onClick={() => setContainer(ext)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold uppercase transition-all ${
                    container === ext
                      ? 'bg-red-500 text-white shadow-sm'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {ext}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              {['mp4', 'mkv'].map((ext) => (
                <button
                  key={ext}
                  type="button"
                  onClick={() => setContainer(ext)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold uppercase transition-all ${
                    container === ext
                      ? 'bg-red-500 text-white shadow-sm'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {ext}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Destination folder reminder */}
        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
          <HardDrive className="w-3.5 h-3.5 text-slate-500" />
          <span>
            Target folder: <strong className="text-red-400">/downloads/{enableTrim ? 'clips' : (mode === 'audio_only' ? 'audio' : 'videos')}</strong>
          </span>
        </div>
      </div>

      {/* Turbo Multi-Threaded Chunk Accelerator Card */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-slate-900 to-amber-500/5 border border-amber-500/25 flex items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl border transition-all ${
            fastDownload
              ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
              : 'bg-slate-800 text-slate-500 border-slate-700'
          }`}>
            <Zap className={`w-5 h-5 ${fastDownload ? 'fill-current animate-pulse' : ''}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-bold text-white">
                Turbo Multi-Threaded Download
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wide">
                2x Faster
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Downloads video & audio in parallel multi-connection chunks to bypass YouTube throttling
            </p>
          </div>
        </div>

        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
          <input
            type="checkbox"
            checked={fastDownload}
            onChange={(e) => setFastDownload(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500" />
        </label>
      </div>

      {/* Download Action Button */}
      <div>
        <button
          type="button"
          onClick={handleStartDownload}
          disabled={downloading}
          className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 disabled:opacity-50 text-white font-bold text-base rounded-2xl shadow-xl shadow-red-600/25 transition-all active:scale-[0.99]"
        >
          <Download className="w-5 h-5 animate-bounce" />
          <span>
            {enableTrim && `Download Clip (${secondsToTimeStr(trimStartSec)} to ${secondsToTimeStr(trimEndSec)})`}
            {!enableTrim && mode === 'both' && `Download ${currentVideoObj?.displayLabel || 'Video'} + ${currentLangObj?.languageName || 'Audio'} (${container.toUpperCase()})`}
            {!enableTrim && mode === 'video_only' && `Download ${currentVideoObj?.displayLabel || 'Video'} Only (${container.toUpperCase()})`}
            {!enableTrim && mode === 'audio_only' && `Download ${currentLangObj?.languageName || 'Audio'} Only (${container.toUpperCase()})`}
          </span>
        </button>
      </div>
    </div>
  );
}
