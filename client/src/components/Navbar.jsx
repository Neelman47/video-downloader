import React from 'react';
import { Download, FolderOpen, Layers, Play } from 'lucide-react';

export default function Navbar({
  activeTab = 'downloader',
  onTabChange,
  onOpenFolder,
  downloadCount = 0
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-2">
        {/* Brand */}
        <div
          onClick={() => onTabChange('downloader')}
          className="flex items-center gap-3 cursor-pointer select-none"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-600 to-rose-500 flex items-center justify-center shadow-lg shadow-red-500/25">
            <Play className="w-5 h-5 text-white fill-white ml-0.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                StreamVault
              </span>
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20 rounded">
                PRO
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden lg:block">
              YouTube Video & Multi-Audio Downloader
            </p>
          </div>
        </div>

        {/* Center Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-2xl border border-slate-800">
          {/* Tab 1: Downloader */}
          <button
            type="button"
            onClick={() => onTabChange('downloader')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'downloader'
                ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md shadow-red-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Downloader</span>
          </button>

          {/* Tab 2: Browse */}
          <button
            type="button"
            onClick={() => onTabChange('browse')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'browse'
                ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md shadow-red-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            <span>Browse</span>
            {downloadCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === 'browse'
                  ? 'bg-white text-red-600'
                  : 'bg-slate-800 text-slate-300'
              }`}>
                {downloadCount}
              </span>
            )}
          </button>

          {/* Tab 3: Merge */}
          <button
            type="button"
            onClick={() => onTabChange('merge')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'merge'
                ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md shadow-red-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Layers className="w-4 h-4 text-amber-400" />
            <span>Merge</span>
            <span className="hidden sm:inline px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
              New
            </span>
          </button>
        </nav>

        {/* Right Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onOpenFolder('')}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50 transition-all hover:text-white"
            title="Open /downloads in File Explorer"
          >
            <FolderOpen className="w-4 h-4 text-amber-400" />
            <span>Downloads</span>
          </button>

          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Ready</span>
          </div>
        </div>
      </div>
    </header>
  );
}
