import React from 'react';
import { Download, Folder, Sparkles, Play, CheckCircle2, AlertCircle } from 'lucide-react';

export default function Navbar({ onOpenFolder, downloadCount }) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
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
            <p className="text-xs text-slate-400 hidden sm:block">
              YouTube Video & Multi-Audio Downloader
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenFolder}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50 transition-all hover:text-white"
            title="Open downloads folder in File Explorer"
          >
            <Folder className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Downloads Folder</span>
            {downloadCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-700 text-slate-200">
                {downloadCount}
              </span>
            )}
          </button>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Engine Ready</span>
          </div>
        </div>
      </div>
    </header>
  );
}
