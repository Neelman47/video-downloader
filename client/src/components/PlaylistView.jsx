import React, { useState } from 'react';
import {
  ListVideo,
  CheckSquare,
  Square,
  Film,
  Music,
  Download,
  Loader2,
  CheckCircle2,
  X,
  HardDrive,
  Play
} from 'lucide-react';

export default function PlaylistView({
  playlist,
  onClose,
  onBatchDownloadComplete,
  onOpenFolder
}) {
  if (!playlist) return null;

  const [selectedVideoIds, setSelectedVideoIds] = useState(
    new Set(playlist.videos.slice(0, 10).map((v) => v.id)) // Default select first 10
  );

  const [mode, setMode] = useState('both');
  const [qualityPreference, setQualityPreference] = useState('best'); // 'best' | '1080p' | '720p' | '360p'
  const [container, setContainer] = useState('mp4');

  // Queue state
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [videoStatuses, setVideoStatuses] = useState({}); // id -> 'pending' | 'downloading' | 'completed' | 'error'
  const [currentProgress, setCurrentProgress] = useState({ percent: '0%', message: '' });
  const [shouldStopQueue, setShouldStopQueue] = useState(false);

  const handleToggleVideo = (id) => {
    if (isProcessingQueue) return;
    const next = new Set(selectedVideoIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedVideoIds(next);
  };

  const handleSelectAll = () => {
    if (isProcessingQueue) return;
    if (selectedVideoIds.size === playlist.videos.length) {
      setSelectedVideoIds(new Set());
    } else {
      setSelectedVideoIds(new Set(playlist.videos.map((v) => v.id)));
    }
  };

  const handleStartBatchDownload = async () => {
    const selectedList = playlist.videos.filter((v) => selectedVideoIds.has(v.id));
    if (!selectedList.length) return;

    setIsProcessingQueue(true);
    setShouldStopQueue(false);

    const initialStatuses = {};
    selectedList.forEach((v) => { initialStatuses[v.id] = 'pending'; });
    setVideoStatuses(initialStatuses);

    for (let i = 0; i < selectedList.length; i++) {
      if (shouldStopQueue) break;

      const video = selectedList[i];
      setCurrentIndex(i);
      setVideoStatuses((prev) => ({ ...prev, [video.id]: 'downloading' }));
      setCurrentProgress({ percent: '10%', message: `Starting ${i + 1}/${selectedList.length}: ${video.title.slice(0, 40)}...` });

      try {
        // Step A: Analyze individual video to get best itag matching user preference
        const analyzeRes = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: video.url })
        });
        const analyzeData = await analyzeRes.json();

        let chosenVideoItag = null;
        let chosenAudioItag = null;

        if (analyzeData.ok && analyzeData.data) {
          const vQualities = analyzeData.data.availableVideoQualities || [];
          if (qualityPreference === '1080p') {
            chosenVideoItag = vQualities.find((q) => q.height === 1080)?.itag || vQualities[0]?.itag;
          } else if (qualityPreference === '720p') {
            chosenVideoItag = vQualities.find((q) => q.height === 720)?.itag || vQualities[0]?.itag;
          } else if (qualityPreference === '360p') {
            chosenVideoItag = vQualities.find((q) => q.height === 360)?.itag || vQualities[vQualities.length - 1]?.itag;
          } else {
            chosenVideoItag = vQualities[0]?.itag;
          }
          chosenAudioItag = analyzeData.data.audioLanguages?.[0]?.bestItag || null;
        }

        // Step B: Start download with subfolder: 'playlists'
        const dlRes = await fetch('/api/download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: video.url,
            mode,
            videoItag: chosenVideoItag,
            audioItag: chosenAudioItag,
            container: mode === 'audio_only' ? 'mp3' : container,
            subfolderOverride: 'playlists'
          })
        });

        const dlData = await dlRes.json();
        if (!dlRes.ok || !dlData.ok) {
          throw new Error(dlData.error || 'Failed to start download');
        }

        const jobId = dlData.jobId;

        // Step C: Wait for job completion via polling
        await new Promise((resolve, reject) => {
          const poller = setInterval(async () => {
            try {
              const stRes = await fetch(`/api/download/status/${jobId}`);
              const stData = await stRes.json();
              if (stData.ok && stData.data) {
                setCurrentProgress({
                  percent: stData.data.percent || '50%',
                  message: `[${i + 1}/${selectedList.length}] ${stData.data.message || 'Processing...'}`
                });

                if (stData.data.status === 'completed') {
                  clearInterval(poller);
                  resolve();
                } else if (stData.data.status === 'error' || stData.data.status === 'cancelled') {
                  clearInterval(poller);
                  reject(new Error(stData.data.error || 'Download failed'));
                }
              }
            } catch (err) {
              clearInterval(poller);
              reject(err);
            }
          }, 1500);
        });

        setVideoStatuses((prev) => ({ ...prev, [video.id]: 'completed' }));
      } catch (err) {
        console.error(`Error downloading video ${video.id}:`, err);
        setVideoStatuses((prev) => ({ ...prev, [video.id]: 'error' }));
      }
    }

    setIsProcessingQueue(false);
    if (onBatchDownloadComplete) onBatchDownloadComplete();
  };

  const isAllSelected = selectedVideoIds.size === playlist.videos.length;

  return (
    <div className="glass-panel rounded-2xl p-5 sm:p-6 border border-slate-800 shadow-2xl space-y-5 animate-fadeIn">
      {/* Header */}
      <div className="flex items-start justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
            <ListVideo className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span>{playlist.title}</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Playlist by <strong className="text-slate-300">{playlist.channel}</strong> • {playlist.videoCount} total videos
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          disabled={isProcessingQueue}
          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          title="Back to single video mode"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Batch Format Options */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
        <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
          <span>Batch Download Settings</span>
          <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
            📁 Saves to: /downloads/playlists
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {/* Mode */}
          <div className="space-y-1">
            <label className="text-xs text-slate-400">Download Mode:</label>
            <div className="flex rounded-xl bg-slate-800 p-0.5 border border-slate-700">
              <button
                type="button"
                onClick={() => setMode('both')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  mode === 'both' ? 'bg-red-500 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Video + Audio
              </button>
              <button
                type="button"
                onClick={() => setMode('audio_only')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  mode === 'audio_only' ? 'bg-red-500 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Audio Only (MP3)
              </button>
            </div>
          </div>

          {/* Video Quality Preference */}
          {mode === 'both' && (
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Target Quality:</label>
              <select
                value={qualityPreference}
                onChange={(e) => setQualityPreference(e.target.value)}
                className="w-full bg-slate-800 text-slate-200 text-xs px-3 py-2 rounded-xl border border-slate-700 outline-none focus:border-red-500"
              >
                <option value="best">Best Available (Highest)</option>
                <option value="1080p">1080p Full HD</option>
                <option value="720p">720p HD</option>
                <option value="360p">360p (Data Saver)</option>
              </select>
            </div>
          )}

          {/* Action button */}
          <div className="space-y-1 sm:self-end">
            <button
              type="button"
              onClick={handleStartBatchDownload}
              disabled={isProcessingQueue || selectedVideoIds.size === 0}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
            >
              {isProcessingQueue ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Downloading ({currentIndex + 1}/{selectedVideoIds.size})...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download Selected ({selectedVideoIds.size} Videos)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Live Queue Progress Bar */}
        {isProcessingQueue && (
          <div className="pt-3 border-t border-slate-800 space-y-1.5 animate-fadeIn">
            <div className="flex justify-between text-xs text-slate-300">
              <span className="font-mono text-red-400 font-semibold">{currentProgress.message}</span>
              <span className="font-mono">{currentProgress.percent}</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-red-500 to-rose-500 h-2 rounded-full transition-all duration-300"
                style={{ width: currentProgress.percent }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Video Selection Controls */}
      <div className="flex items-center justify-between text-xs px-1">
        <button
          type="button"
          onClick={handleSelectAll}
          disabled={isProcessingQueue}
          className="flex items-center gap-1.5 text-slate-300 hover:text-white font-medium"
        >
          {isAllSelected ? (
            <CheckSquare className="w-4 h-4 text-red-500" />
          ) : (
            <Square className="w-4 h-4 text-slate-500" />
          )}
          <span>Select All ({playlist.videos.length})</span>
        </button>

        <span className="text-slate-400">
          Selected <strong className="text-white">{selectedVideoIds.size}</strong> of {playlist.videos.length} videos
        </span>
      </div>

      {/* Playlist Videos Checklist */}
      <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1 divide-y divide-slate-800/40">
        {playlist.videos.map((v, idx) => {
          const isSelected = selectedVideoIds.has(v.id);
          const status = videoStatuses[v.id];

          return (
            <div
              key={v.id}
              onClick={() => handleToggleVideo(v.id)}
              className={`pt-2 pb-2 px-2 flex items-center justify-between gap-3 rounded-xl transition-all cursor-pointer ${
                isSelected ? 'bg-slate-900/80 border border-slate-800/90' : 'opacity-60 hover:opacity-100 hover:bg-slate-900/40'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="font-mono text-xs text-slate-500 w-6 text-right">
                  {idx + 1}
                </span>

                <button
                  type="button"
                  className="text-slate-400 hover:text-white flex-shrink-0"
                >
                  {isSelected ? (
                    <CheckSquare className="w-4 h-4 text-red-500" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-600" />
                  )}
                </button>

                {v.thumbnail && (
                  <img
                    src={v.thumbnail}
                    alt={v.title}
                    className="w-16 h-10 object-cover rounded-lg flex-shrink-0 border border-slate-800"
                  />
                )}

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-200 truncate" title={v.title}>
                    {v.title}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                    {v.durationFormatted}
                  </p>
                </div>
              </div>

              {/* Status Indicator */}
              <div className="flex-shrink-0 text-xs">
                {status === 'downloading' && (
                  <span className="flex items-center gap-1 text-amber-400 font-mono text-[11px]">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Downloading</span>
                  </span>
                )}
                {status === 'completed' && (
                  <span className="flex items-center gap-1 text-emerald-400 font-mono text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Done</span>
                  </span>
                )}
                {status === 'error' && (
                  <span className="text-red-400 font-mono text-[11px]">
                    Failed
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
