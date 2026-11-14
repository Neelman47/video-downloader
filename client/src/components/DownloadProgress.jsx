import React from 'react';
import { Loader2, CheckCircle2, AlertTriangle, XCircle, FolderOpen, ArrowDownCircle, ShieldCheck, X } from 'lucide-react';

export default function DownloadProgress({ job, onCancel, onOpenFolder, onDownloadFile, onClose }) {
  if (!job) return null;

  const isCompleted = job.status === 'completed';
  const isError = job.status === 'error';
  const isCancelled = job.status === 'cancelled';
  const isMerging = job.status === 'merging';
  const isDownloading = job.status === 'downloading' || job.status === 'starting';

  const percentNumber = parseInt(job.percent) || (isCompleted ? 100 : 5);

  return (
    <div className="glass-panel rounded-2xl p-5 border border-slate-800 shadow-2xl relative overflow-hidden animate-fadeIn">
      {/* Top Status Banner */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          {isDownloading && <Loader2 className="w-5 h-5 text-red-500 animate-spin" />}
          {isMerging && <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />}
          {isCompleted && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
          {isError && <AlertTriangle className="w-5 h-5 text-red-400" />}
          {isCancelled && <XCircle className="w-5 h-5 text-slate-400" />}

          <div>
            <h4 className="text-sm font-bold text-white">
              {isCompleted && 'Download Completed!'}
              {isError && 'Download Failed'}
              {isCancelled && 'Download Cancelled'}
              {isMerging && 'Merging Streams with FFmpeg...'}
              {isDownloading && 'Downloading from YouTube...'}
            </h4>
            <p className="text-xs text-slate-400">
              {job.message || (isCompleted ? 'File stored in downloads folder' : 'Processing stream')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Cancel button if active */}
          {!isCompleted && !isError && !isCancelled && (
            <button
              type="button"
              onClick={() => onCancel(job.jobId)}
              className="px-2.5 py-1 text-xs font-semibold text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors border border-slate-800"
            >
              Cancel
            </button>
          )}

          {/* Close icon button when completed or terminated */}
          {(isCompleted || isError || isCancelled) && onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Close notification"
              aria-label="Close"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all border border-slate-800 hover:border-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
          <div className="flex items-center gap-2">
            <span className="text-slate-300">
              {isCompleted ? '100%' : job.percent || '0%'}
            </span>
            {job.fastDownload && (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                ⚡ Turbo Multi-Threaded
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-slate-400 font-mono text-[11px]">
            {job.speed && job.speed !== '--' && <span>⚡ {job.speed}</span>}
            {job.eta && job.eta !== '--' && <span>⏱️ ETA: {job.eta}</span>}
            {job.totalSize && <span>💾 {job.totalSize}</span>}
          </div>
        </div>

        <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isCompleted
                ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50'
                : isError
                ? 'bg-red-500'
                : 'bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 shadow-sm shadow-red-500/50'
            }`}
            style={{ width: `${percentNumber}%` }}
          />
        </div>
      </div>

      {/* When completed, show action buttons */}
      {isCompleted && (
        <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-300">
            Saved as: <strong className="text-white font-mono">{job.fileName}</strong> ({job.fileSizeFormatted})
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenFolder}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition-colors"
            >
              <FolderOpen className="w-4 h-4 text-amber-400" />
              <span>Open in Explorer</span>
            </button>

            {job.fileName && (
              <button
                type="button"
                onClick={() => onDownloadFile(job.fileName)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-xl transition-colors shadow-md shadow-red-600/30"
              >
                <ArrowDownCircle className="w-4 h-4" />
                <span>Save to Browser</span>
              </button>
            )}

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                title="Close download completed card"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-xl border border-slate-700/60 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                <span>Close</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* When error, show error detail with close button */}
      {isError && (
        <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-center justify-between gap-2">
          <span>{job.error || 'An unexpected error occurred during download.'}</span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-red-400 hover:text-white p-1 rounded-lg hover:bg-red-500/20 transition-colors"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
