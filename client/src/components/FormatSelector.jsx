import React, { useState, useEffect } from 'react';
import { Film, Music, Video, Check, Sparkles, Globe, HardDrive, Download, ChevronDown, CheckCircle2 } from 'lucide-react';

export default function FormatSelector({ video, onDownload, downloading }) {
  if (!video) return null;

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

  // When language changes, update the selectedAudioItag
  const handleLanguageChange = (langName) => {
    setSelectedLanguageName(langName);
    const langObj = video.audioLanguages.find(l => l.languageName === langName);
    if (langObj) {
      setSelectedAudioItag(langObj.bestItag);
    }
  };

  // Find currently selected video and audio objects
  const currentVideoObj = video.availableVideoQualities?.find(v => v.itag === selectedVideoItag) || video.availableVideoQualities?.[0];
  const currentLangObj = video.audioLanguages?.find(l => l.languageName === selectedLanguageName) || video.audioLanguages?.[0];
  const currentAudioTrackObj = currentLangObj?.tracks?.find(t => t.itag === selectedAudioItag) || currentLangObj?.tracks?.[0];

  const handleStartDownload = () => {
    const downloadUrl = video.webpageUrl || (video.id ? `https://www.youtube.com/watch?v=${video.id}` : '');
    onDownload({
      url: downloadUrl,
      mode,
      videoItag: selectedVideoItag,
      audioItag: selectedAudioItag,
      audioLanguage: selectedLanguageName,
      audioTrackId: currentLangObj?.trackId || currentAudioTrackObj?.trackId || null,
      container: mode === 'audio_only' ? (container === 'mp3' ? 'mp3' : 'm4a') : container,
      title: video.title
    });
  };

  return (
    <div className="glass-panel rounded-2xl p-5 sm:p-6 border border-slate-800 shadow-2xl">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-red-500" />
            <span>Customize Download</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Select what you want to download, your preferred quality, and audio language
          </p>
        </div>
      </div>

      {/* FEATURE 3: Download Mode Selector (Both / Video Only / Audio Only) */}
      <div className="mt-5">
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

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* FEATURE 1: Available Video Quality (for 'both' and 'video_only') */}
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

            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {video.availableVideoQualities?.map((vq) => {
                const isSelected = vq.itag === selectedVideoItag;
                return (
                  <button
                    key={vq.itag}
                    type="button"
                    onClick={() => setSelectedVideoItag(vq.itag)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-left text-xs transition-all ${
                      isSelected
                        ? 'bg-slate-800/90 border-red-500/80 text-white shadow-sm'
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

        {/* FEATURE 2: Available Audio & Languages (for 'both' and 'audio_only') */}
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

            {/* Language Selection List */}
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {video.audioLanguages?.map((lang) => {
                const isSelected = lang.languageName === selectedLanguageName;
                return (
                  <button
                    key={lang.languageName}
                    type="button"
                    onClick={() => handleLanguageChange(lang.languageName)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-left text-xs transition-all ${
                      isSelected
                        ? 'bg-slate-800/90 border-sky-500/80 text-white shadow-sm'
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

      {/* Output Format Container Selection */}
      <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
          <span>Output Format:</span>
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
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <HardDrive className="w-3.5 h-3.5 text-slate-500" />
          <span>Saves to: <strong className="text-slate-300 font-mono text-[11px]">/downloads</strong></span>
        </div>
      </div>

      {/* Download Action Button */}
      <div className="mt-5">
        <button
          type="button"
          onClick={handleStartDownload}
          disabled={downloading}
          className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 disabled:opacity-50 text-white font-bold text-base rounded-2xl shadow-xl shadow-red-600/25 transition-all active:scale-[0.99]"
        >
          <Download className="w-5 h-5 animate-bounce" />
          <span>
            {mode === 'both' && `Download ${currentVideoObj?.displayLabel || 'Video'} + ${currentLangObj?.languageName || 'Audio'} (${container.toUpperCase()})`}
            {mode === 'video_only' && `Download ${currentVideoObj?.displayLabel || 'Video'} Only (${container.toUpperCase()})`}
            {mode === 'audio_only' && `Download ${currentLangObj?.languageName || 'Audio'} Only (${container.toUpperCase()})`}
          </span>
        </button>
      </div>
    </div>
  );
}
