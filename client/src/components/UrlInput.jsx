import React, { useState } from 'react';
import { Search, Clipboard, X, Loader2, PlayCircle, Globe, Film, ListVideo } from 'lucide-react';

export default function UrlInput({
  url,
  setUrl,
  onAnalyze,
  onAnalyzePlaylist,
  loading,
  error,
  setError
}) {
  const [pasted, setPasted] = useState(false);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text.trim());
        setPasted(true);
        setTimeout(() => setPasted(false), 1500);
      }
    } catch (e) {
      console.warn('Clipboard access denied or unsupported');
    }
  };

  const handleClear = () => {
    setUrl('');
    if (setError) setError(null);
  };

  const isPlaylistUrl = url.includes('list=');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    if (isPlaylistUrl && onAnalyzePlaylist) {
      onAnalyzePlaylist(url.trim());
    } else {
      onAnalyze(url.trim());
    }
  };

  const loadSample = (sampleUrl, isPl = false) => {
    setUrl(sampleUrl);
    if (setError) setError(null);
    if (isPl && onAnalyzePlaylist) {
      onAnalyzePlaylist(sampleUrl);
    } else {
      onAnalyze(sampleUrl);
    }
  };

  return (
    <div className="w-full space-y-2">
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative flex items-center">
          <div className="absolute left-4 pointer-events-none text-slate-400">
            {isPlaylistUrl ? (
              <ListVideo className="w-5 h-5 text-red-400" />
            ) : (
              <Search className="w-5 h-5" />
            )}
          </div>

          <input
            type="text"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (error && setError) setError(null);
            }}
            placeholder="Paste YouTube video or playlist link (e.g. https://www.youtube.com/watch?v=... or playlist?list=...)"
            className="w-full pl-12 pr-44 sm:pr-56 py-4 bg-slate-900/90 border-2 border-slate-700/80 focus:border-red-500 rounded-2xl text-slate-100 placeholder-slate-500 text-sm sm:text-base transition-all outline-none shadow-2xl focus:shadow-red-500/10"
            disabled={loading}
          />

          <div className="absolute right-2 flex items-center gap-1.5">
            {url && !loading && (
              <button
                type="button"
                onClick={handleClear}
                className="p-2 text-slate-400 hover:text-slate-200 transition-colors rounded-xl hover:bg-slate-800"
                title="Clear input"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {!url && (
              <button
                type="button"
                onClick={handlePaste}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all border border-slate-700/50"
              >
                <Clipboard className="w-3.5 h-3.5" />
                <span>{pasted ? 'Pasted!' : 'Paste'}</span>
              </button>
            )}

            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="flex items-center gap-2 px-4 sm:px-5 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-xs sm:text-sm rounded-xl transition-all shadow-md shadow-red-600/30 active:scale-95"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <span>{isPlaylistUrl ? 'Analyze Playlist' : 'Analyze'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Detected Playlist Banner */}
      {isPlaylistUrl && !loading && (
        <div className="flex items-center justify-between p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300 animate-fadeIn">
          <div className="flex items-center gap-2">
            <ListVideo className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>YouTube Playlist detected! You can download the entire playlist or analyze as single video.</span>
          </div>
          <button
            type="button"
            onClick={() => onAnalyze(url.trim())}
            className="text-slate-300 hover:text-white underline text-[11px] font-medium"
          >
            Analyze single video instead
          </button>
        </div>
      )}

      {/* Quick Test Samples */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 pt-1">
        <span className="text-slate-500 font-medium">Quick samples:</span>
        <button
          type="button"
          onClick={() => loadSample('https://www.youtube.com/watch?v=aqz-KE-bpKQ')}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/40 transition-colors"
        >
          <Film className="w-3 h-3 text-red-400" />
          <span>4K Demo</span>
        </button>
        <button
          type="button"
          onClick={() => loadSample('https://www.youtube.com/watch?v=0e3GPea1Tyg')}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/40 transition-colors"
        >
          <Globe className="w-3 h-3 text-sky-400" />
          <span>Multi-Lang & Subtitles (MrBeast)</span>
        </button>
        <button
          type="button"
          onClick={() => loadSample('https://www.youtube.com/playlist?list=PLrAXtmErZgOdP_8GztsuKi9nrraNbKKp4', true)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/40 transition-colors"
        >
          <ListVideo className="w-3 h-3 text-amber-400" />
          <span>Sample Playlist (Lex Fridman)</span>
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-3">
          <div className="w-2 h-2 rounded-full bg-red-400 mt-1.5 flex-shrink-0"></div>
          <div className="flex-1">
            <p className="font-semibold text-red-300">Analysis Error</p>
            <p className="text-xs text-red-400/90 mt-0.5">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
