import React, { useState } from 'react';
import {
  Film,
  Music,
  Download,
  Trash2,
  FolderOpen,
  RefreshCw,
  HardDrive,
  FileText,
  Scissors,
  Subtitles,
  ListVideo,
  CheckSquare,
  Square,
  AlertTriangle,
  X
} from 'lucide-react';

export default function DownloadedList({
  files,
  onRefresh,
  onDelete,
  onDeleteMultiple,
  onDeleteAll,
  onDownloadFile,
  onOpenFolder,
  loading
}) {
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedFiles, setSelectedFiles] = useState(new Set());
  const [showConfirmDeleteAll, setShowConfirmDeleteAll] = useState(false);
  const [showConfirmDeleteSelected, setShowConfirmDeleteSelected] = useState(false);

  // Filter files by active category
  const filteredFiles = files.filter((f) => {
    if (activeCategory === 'all') return true;
    if (activeCategory === 'videos') return f.category === 'videos' || f.type === 'video';
    if (activeCategory === 'audio') return f.category === 'audio' || f.type === 'audio';
    if (activeCategory === 'clips') return f.category === 'clips';
    if (activeCategory === 'subtitles') return f.category === 'subtitles' || f.type === 'subtitle';
    if (activeCategory === 'playlists') return f.category === 'playlists';
    return true;
  });

  // Category counts
  const counts = {
    all: files.length,
    videos: files.filter((f) => f.category === 'videos' || f.type === 'video').length,
    audio: files.filter((f) => f.category === 'audio' || f.type === 'audio').length,
    clips: files.filter((f) => f.category === 'clips').length,
    subtitles: files.filter((f) => f.category === 'subtitles' || f.type === 'subtitle').length,
    playlists: files.filter((f) => f.category === 'playlists').length
  };

  const handleToggleSelect = (relPath) => {
    const next = new Set(selectedFiles);
    if (next.has(relPath)) {
      next.delete(relPath);
    } else {
      next.add(relPath);
    }
    setSelectedFiles(next);
  };

  const handleSelectAll = () => {
    if (selectedFiles.size === filteredFiles.length) {
      setSelectedFiles(new Set());
    } else {
      const allPaths = new Set(filteredFiles.map((f) => f.relativePath || f.name));
      setSelectedFiles(allPaths);
    }
  };

  const handleConfirmDeleteSelected = async () => {
    const list = Array.from(selectedFiles);
    if (!list.length) return;
    setShowConfirmDeleteSelected(false);
    await onDeleteMultiple(list);
    setSelectedFiles(new Set());
  };

  const handleConfirmDeleteAll = async () => {
    setShowConfirmDeleteAll(false);
    await onDeleteAll();
    setSelectedFiles(new Set());
  };

  const isAllSelected = filteredFiles.length > 0 && selectedFiles.size === filteredFiles.length;

  return (
    <div className="glass-panel rounded-2xl p-5 sm:p-6 border border-slate-800 shadow-2xl space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
        <div className="flex items-center gap-2.5">
          <HardDrive className="w-5 h-5 text-amber-400" />
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>Downloaded Media</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300">
                {files.length}
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Files organized in <code className="text-slate-300 font-mono">/downloads/videos</code>, <code className="text-slate-300 font-mono">audio</code>, <code className="text-slate-300 font-mono">clips</code>, <code className="text-slate-300 font-mono">subtitles</code>, & <code className="text-slate-300 font-mono">playlists</code>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Refresh */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 rounded-xl transition-all border border-slate-700/50"
            title="Refresh file list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-red-400' : ''}`} />
          </button>

          {/* Open Subfolder or Root */}
          <button
            type="button"
            onClick={() => onOpenFolder(activeCategory === 'all' ? '' : activeCategory)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all border border-slate-700/50"
            title={`Open /downloads${activeCategory !== 'all' ? `/${activeCategory}` : ''} in File Explorer`}
          >
            <FolderOpen className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Open Folder</span>
          </button>

          {/* Delete All button */}
          {files.length > 0 && (
            <button
              type="button"
              onClick={() => setShowConfirmDeleteAll(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-300 bg-red-950/40 hover:bg-red-900/60 rounded-xl transition-all border border-red-800/40"
              title="Delete all downloaded files"
            >
              <Trash2 className="w-4 h-4 text-red-400" />
              <span>Delete All</span>
            </button>
          )}
        </div>
      </div>

      {/* Subfolder Category Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        {[
          { id: 'all', label: 'All Files', icon: HardDrive },
          { id: 'videos', label: 'Videos', icon: Film },
          { id: 'audio', label: 'Audio', icon: Music },
          { id: 'clips', label: 'Clips', icon: Scissors },
          { id: 'subtitles', label: 'Subtitles', icon: Subtitles },
          { id: 'playlists', label: 'Playlists', icon: ListVideo }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeCategory === tab.id;
          const count = counts[tab.id] || 0;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveCategory(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-red-500/20 text-red-300 border border-red-500/30 shadow-sm'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                isActive ? 'bg-red-500 text-white' : 'bg-slate-800 text-slate-400'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Batch Selection Action Bar */}
      {filteredFiles.length > 0 && (
        <div className="flex items-center justify-between py-2 px-3 bg-slate-900/80 rounded-xl border border-slate-800/80 text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAll}
              className="flex items-center gap-1.5 text-slate-300 hover:text-white font-medium"
            >
              {isAllSelected ? (
                <CheckSquare className="w-4 h-4 text-red-500" />
              ) : (
                <Square className="w-4 h-4 text-slate-500" />
              )}
              <span>Select All ({filteredFiles.length})</span>
            </button>

            {selectedFiles.size > 0 && (
              <span className="text-slate-400 ml-2">
                • <strong className="text-white">{selectedFiles.size}</strong> selected
              </span>
            )}
          </div>

          {selectedFiles.size > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedFiles(new Set())}
                className="px-2.5 py-1 text-slate-400 hover:text-white"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setShowConfirmDeleteSelected(true)}
                className="flex items-center gap-1.5 px-3 py-1 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg shadow transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Selected ({selectedFiles.size})</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Files List */}
      <div>
        {filteredFiles.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <Film className="w-10 h-10 mx-auto text-slate-700 mb-2 stroke-[1.5]" />
            <p className="text-sm font-medium">No files found in {activeCategory} category</p>
            <p className="text-xs text-slate-600 mt-0.5">
              Downloaded items will automatically be routed into their designated subfolder
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60 max-h-96 overflow-y-auto pr-1">
            {filteredFiles.map((file) => {
              const fileId = file.relativePath || file.name;
              const isSelected = selectedFiles.has(fileId);
              const isVideo = file.type === 'video';
              const isAudio = file.type === 'audio';
              const isClip = file.category === 'clips';
              const isSub = file.category === 'subtitles' || file.type === 'subtitle';

              return (
                <div
                  key={fileId}
                  className={`py-2.5 px-2.5 flex items-center justify-between gap-3 rounded-xl transition-colors group ${
                    isSelected ? 'bg-red-500/10 border border-red-500/30' : 'hover:bg-slate-900/50'
                  }`}
                >
                  {/* Checkbox & Icon */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => handleToggleSelect(fileId)}
                      className="text-slate-400 hover:text-white flex-shrink-0"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-red-500" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-600 hover:text-slate-400" />
                      )}
                    </button>

                    <div className={`p-2 rounded-xl flex-shrink-0 ${
                      isClip ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                      isSub ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      isVideo ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                      isAudio ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' :
                      'bg-slate-800 text-slate-400'
                    }`}>
                      {isClip && <Scissors className="w-4 h-4" />}
                      {!isClip && isSub && <Subtitles className="w-4 h-4" />}
                      {!isClip && !isSub && isVideo && <Film className="w-4 h-4" />}
                      {!isClip && !isSub && isAudio && <Music className="w-4 h-4" />}
                      {!isClip && !isSub && !isVideo && !isAudio && <FileText className="w-4 h-4" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-semibold text-slate-200 truncate group-hover:text-white" title={file.name}>
                        {file.name}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5 flex-wrap">
                        {/* Subfolder Badge */}
                        <span className="font-mono text-[10px] px-1.5 py-0.2 bg-slate-800/90 text-slate-300 rounded border border-slate-700/60">
                          📁 {file.folder || file.category || 'downloads'}
                        </span>
                        <span className="font-mono">{file.sizeFormatted}</span>
                        <span>•</span>
                        <span className="uppercase font-mono text-[10px] px-1 py-0.2 bg-slate-800 text-slate-400 rounded">
                          {file.extension}
                        </span>
                        <span>•</span>
                        <span>{new Date(file.createdAt).toLocaleDateString()} {new Date(file.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => onDownloadFile(file.relativePath || file.name)}
                      className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                      title="Save / download file to browser"
                    >
                      <Download className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onDelete(file.relativePath || file.name)}
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

      {/* Confirmation Modal: Delete Selected */}
      {showConfirmDeleteSelected && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-fadeIn">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="w-6 h-6" />
              <h4 className="text-base font-bold text-white">Delete Selected Files?</h4>
            </div>
            <p className="text-xs text-slate-300">
              Are you sure you want to delete <strong className="text-white">{selectedFiles.size} selected file(s)</strong>? This will permanently remove them from disk.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmDeleteSelected(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSelected}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-xl shadow"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete ALL */}
      {showConfirmDeleteAll && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-fadeIn">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="w-6 h-6" />
              <h4 className="text-base font-bold text-white">Delete ALL Downloaded Files?</h4>
            </div>
            <p className="text-xs text-slate-300">
              This will permanently delete <strong className="text-red-400">all {files.length} downloaded files</strong> across all subfolders (<code className="text-slate-200">videos</code>, <code className="text-slate-200">audio</code>, <code className="text-slate-200">clips</code>, <code className="text-slate-200">subtitles</code>, <code className="text-slate-200">playlists</code>).
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmDeleteAll(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteAll}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-xl shadow"
              >
                Yes, Delete Everything
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
