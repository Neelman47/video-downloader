import React from 'react';
import { Film, Music, Download, Trash2, FolderOpen, RefreshCw, HardDrive, FileText } from 'lucide-react';

export default function DownloadedList({ files, onRefresh, onDelete, onDownloadFile, onOpenFolder, loading }) {
  return (
    <div className="glass-panel rounded-2xl p-5 sm:p-6 border border-slate-800 shadow-2xl">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <HardDrive className="w-5 h-5 text-amber-400" />
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>Downloaded Files</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300">
                {files.length}
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Files stored locally in your <code className="text-slate-300">/downloads</code> directory
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 rounded-xl transition-all border border-slate-700/50"
            title="Refresh file list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-red-400' : ''}`} />
          </button>

          <button
            type="button"
            onClick={onOpenFolder}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all border border-slate-700/50"
            title="Open folder in File Explorer"
          >
            <FolderOpen className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Open Folder</span>
          </button>
        </div>
      </div>

      {/* Files List */}
      <div className="mt-4">
        {files.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <Film className="w-10 h-10 mx-auto text-slate-700 mb-2 stroke-[1.5]" />
            <p className="text-sm font-medium">No downloaded files yet</p>
            <p className="text-xs text-slate-600 mt-0.5">
              Paste a YouTube link above and click Download to save videos and audio here
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60 max-h-96 overflow-y-auto pr-1">
            {files.map((file) => {
              const isVideo = file.type === 'video';
              const isAudio = file.type === 'audio';

              return (
                <div
                  key={file.name}
                  className="py-3 px-2 flex items-center justify-between gap-3 hover:bg-slate-900/40 rounded-xl transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`p-2 rounded-xl flex-shrink-0 ${
                      isVideo ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                      isAudio ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' :
                      'bg-slate-800 text-slate-400'
                    }`}>
                      {isVideo && <Film className="w-4 h-4" />}
                      {isAudio && <Music className="w-4 h-4" />}
                      {!isVideo && !isAudio && <FileText className="w-4 h-4" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-semibold text-slate-200 truncate group-hover:text-white" title={file.name}>
                        {file.name}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                        <span className="font-mono">{file.sizeFormatted}</span>
                        <span>•</span>
                        <span className="uppercase font-mono text-[10px] px-1 py-0.2 bg-slate-800 text-slate-400 rounded">
                          {file.extension}
                        </span>
                        <span>•</span>
                        <span>{new Date(file.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => onDownloadFile(file.name)}
                      className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                      title="Save file to browser / download"
                    >
                      <Download className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onDelete(file.name)}
                      className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Delete file"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
