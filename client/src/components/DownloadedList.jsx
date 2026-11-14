import React, { useState, useMemo } from 'react';
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
  Layers,
  CheckSquare,
  Square,
  AlertTriangle,
  Calendar,
  Search,
  X,
  Filter
} from 'lucide-react';

export default function DownloadedList({
  files = [],
  onRefresh,
  onDelete,
  onDeleteMultiple,
  onDeleteAll,
  onDownloadFile,
  onOpenFolder,
  loading
}) {
  const [activeCategory, setActiveCategory] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFiles, setSelectedFiles] = useState(new Set());
  const [showConfirmDeleteAll, setShowConfirmDeleteAll] = useState(false);
  const [showConfirmDeleteSelected, setShowConfirmDeleteSelected] = useState(false);

  // Date filter calculation
  const dateRanges = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);

    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    return {
      startOfToday,
      startOfYesterday,
      sevenDaysAgo,
      thirtyDaysAgo,
      ninetyDaysAgo,
      sixMonthsAgo,
      oneYearAgo
    };
  }, []);

  // Filter files by category, date, and search query
  const filteredFiles = useMemo(() => {
    return files.filter((f) => {
      // 1. Category filter
      if (activeCategory === 'videos' && f.category !== 'videos' && f.type !== 'video') return false;
      if (activeCategory === 'audio' && f.category !== 'audio' && f.type !== 'audio') return false;
      if (activeCategory === 'clips' && f.category !== 'clips') return false;
      if (activeCategory === 'subtitles' && f.category !== 'subtitles' && f.type !== 'subtitle') return false;
      if (activeCategory === 'playlists' && f.category !== 'playlists') return false;
      if (activeCategory === 'merged' && f.category !== 'merged') return false;

      // 2. Date filter
      const fileDate = new Date(f.createdAt || f.modifiedAt);
      if (dateFilter === 'today') {
        if (fileDate < dateRanges.startOfToday) return false;
      } else if (dateFilter === 'yesterday') {
        if (fileDate < dateRanges.startOfYesterday || fileDate >= dateRanges.startOfToday) return false;
      } else if (dateFilter === 'last_week') {
        if (fileDate < dateRanges.sevenDaysAgo) return false;
      } else if (dateFilter === 'last_month') {
        if (fileDate < dateRanges.thirtyDaysAgo) return false;
      } else if (dateFilter === 'last_3_months') {
        if (fileDate < dateRanges.ninetyDaysAgo) return false;
      } else if (dateFilter === 'last_6_months') {
        if (fileDate < dateRanges.sixMonthsAgo) return false;
      } else if (dateFilter === 'last_year') {
        if (fileDate < dateRanges.oneYearAgo) return false;
      }

      // 3. Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const nameMatch = f.name.toLowerCase().includes(query);
        const folderMatch = (f.folder || '').toLowerCase().includes(query);
        if (!nameMatch && !folderMatch) return false;
      }

      return true;
    });
  }, [files, activeCategory, dateFilter, searchQuery, dateRanges]);

  // Dynamic counts per category
  const categoryCounts = useMemo(() => {
    return {
      all: files.length,
      videos: files.filter((f) => f.category === 'videos' || f.type === 'video').length,
      audio: files.filter((f) => f.category === 'audio' || f.type === 'audio').length,
      clips: files.filter((f) => f.category === 'clips').length,
      subtitles: files.filter((f) => f.category === 'subtitles' || f.type === 'subtitle').length,
      playlists: files.filter((f) => f.category === 'playlists').length,
      merged: files.filter((f) => f.category === 'merged').length
    };
  }, [files]);

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
    <div className="glass-panel rounded-2xl p-5 sm:p-7 border border-slate-800 shadow-2xl space-y-5 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <span>Downloaded Media Library</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300">
                {files.length} items
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Browse, search, direct download, or manage files stored across your local <code className="text-slate-300 font-mono">/downloads</code> subfolders
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
            onClick={() => onOpenFolder(activeCategory === 'all' ? '' : activeCategory === 'merged' ? 'merged_items' : activeCategory)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all border border-slate-700/50 shadow"
            title={`Open /downloads${activeCategory !== 'all' ? `/${activeCategory}` : ''} in File Explorer`}
          >
            <FolderOpen className="w-4 h-4 text-amber-400" />
            <span>Open in Explorer</span>
          </button>

          {/* Delete All button */}
          {files.length > 0 && (
            <button
              type="button"
              onClick={() => setShowConfirmDeleteAll(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-300 bg-red-950/40 hover:bg-red-900/60 rounded-xl transition-all border border-red-800/40"
              title="Delete all downloaded files across all subfolders"
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
          { id: 'playlists', label: 'Playlists', icon: ListVideo },
          { id: 'merged', label: 'Merged Items', icon: Layers }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeCategory === tab.id;
          const count = categoryCounts[tab.id] || 0;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveCategory(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-medium transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-red-500/20 text-red-300 border border-red-500/40 shadow-sm'
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

      {/* Secondary Controls: Date/Time Filter & Search Input */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
        {/* Search Bar */}
        <div className="sm:col-span-7 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by file name or folder..."
            className="w-full pl-9 pr-9 py-2 bg-slate-900/70 border border-slate-800 focus:border-red-500 rounded-xl text-xs text-slate-200 placeholder-slate-500 outline-none transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Date Filter Dropdown */}
        <div className="sm:col-span-5 relative flex items-center">
          <div className="absolute left-3.5 pointer-events-none text-slate-400 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-amber-400" />
          </div>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-slate-900/70 border border-slate-800 focus:border-red-500 rounded-xl text-xs text-slate-200 outline-none cursor-pointer appearance-none transition-all"
          >
            <option value="all">📅 Date Filter: All Time</option>
            <option value="today">📅 Today</option>
            <option value="yesterday">📅 Yesterday</option>
            <option value="last_week">📅 Last Week (7 days)</option>
            <option value="last_month">📅 Last Month (30 days)</option>
            <option value="last_3_months">📅 Last 3 Months (90 days)</option>
            <option value="last_6_months">📅 Last 6 Months (180 days)</option>
            <option value="last_year">📅 Last Year (365 days)</option>
          </select>
          <div className="absolute right-3 pointer-events-none text-slate-500 text-xs">
            ▼
          </div>
        </div>
      </div>

      {/* Batch Selection Action Bar */}
      {filteredFiles.length > 0 && (
        <div className="flex items-center justify-between py-2 px-3 bg-slate-900/90 rounded-xl border border-slate-800 text-xs">
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
          <div className="py-16 text-center text-slate-500 space-y-2">
            <Film className="w-12 h-12 mx-auto text-slate-700 stroke-[1.5]" />
            <p className="text-sm font-semibold text-slate-400">No media files found</p>
            <p className="text-xs text-slate-600 max-w-sm mx-auto">
              {searchQuery || dateFilter !== 'all' || activeCategory !== 'all'
                ? 'Try adjusting your search query, category, or date filter above.'
                : 'Downloaded or merged files will appear here automatically.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60 max-h-[550px] overflow-y-auto pr-1">
            {filteredFiles.map((file) => {
              const fileId = file.relativePath || file.name;
              const isSelected = selectedFiles.has(fileId);
              const isVideo = file.type === 'video';
              const isAudio = file.type === 'audio';
              const isClip = file.category === 'clips';
              const isSub = file.category === 'subtitles' || file.type === 'subtitle';
              const isMerged = file.category === 'merged';
              const isPlaylist = file.category === 'playlists';

              return (
                <div
                  key={fileId}
                  className={`py-3 px-2.5 flex items-center justify-between gap-3 rounded-xl transition-colors group ${
                    isSelected ? 'bg-red-500/10 border border-red-500/30' : 'hover:bg-slate-900/50'
                  }`}
                >
                  {/* Checkbox & Media Icon */}
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

                    <div className={`p-2.5 rounded-xl flex-shrink-0 ${
                      isMerged ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' :
                      isClip ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                      isSub ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      isVideo ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                      isAudio ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' :
                      'bg-slate-800 text-slate-400'
                    }`}>
                      {isMerged && <Layers className="w-4 h-4 text-amber-400" />}
                      {!isMerged && isClip && <Scissors className="w-4 h-4" />}
                      {!isMerged && !isClip && isSub && <Subtitles className="w-4 h-4" />}
                      {!isMerged && !isClip && !isSub && isPlaylist && <ListVideo className="w-4 h-4" />}
                      {!isMerged && !isClip && !isSub && !isPlaylist && isVideo && <Film className="w-4 h-4" />}
                      {!isMerged && !isClip && !isSub && !isPlaylist && isAudio && <Music className="w-4 h-4" />}
                      {!isMerged && !isClip && !isSub && !isPlaylist && !isVideo && !isAudio && <FileText className="w-4 h-4" />}
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
              This will permanently delete <strong className="text-red-400">all {files.length} downloaded files</strong> across all subfolders (<code className="text-slate-200">videos</code>, <code className="text-slate-200">audio</code>, <code className="text-slate-200">clips</code>, <code className="text-slate-200">subtitles</code>, <code className="text-slate-200">playlists</code>, <code className="text-slate-200">merged_items</code>).
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
