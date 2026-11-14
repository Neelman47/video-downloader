import React from 'react';
import { Eye, Clock, Calendar, ExternalLink, User, Globe2 } from 'lucide-react';

export default function VideoCard({ video }) {
  if (!video) return null;

  return (
    <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-xl">
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-5">
        {/* Thumbnail with duration badge */}
        <div className="relative flex-shrink-0 w-full sm:w-64 aspect-video rounded-xl overflow-hidden bg-slate-900 border border-slate-800 group">
          {video.thumbnail ? (
            <img
              src={video.thumbnail}
              alt={video.title}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-600">
              No Preview
            </div>
          )}
          {video.durationFormatted && (
            <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/85 text-white text-xs font-semibold backdrop-blur-sm flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>{video.durationFormatted}</span>
            </div>
          )}
        </div>

        {/* Video Metadata */}
        <div className="flex-1 flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white line-clamp-2 leading-snug">
                {video.title}
              </h2>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-slate-400">
              {/* Channel */}
              <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>{video.channel}</span>
              </div>

              {/* Views */}
              {video.viewCountFormatted && (
                <div className="flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5 text-slate-500" />
                  <span>{video.viewCountFormatted} views</span>
                </div>
              )}

              {/* Upload Date */}
              {video.uploadDate && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>{video.uploadDate}</span>
                </div>
              )}
            </div>

            {/* Badges */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {video.hasMultipleAudioLanguages && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  <Globe2 className="w-3 h-3" />
                  <span>{video.audioLanguages.length} Audio Languages Available</span>
                </span>
              )}

              {video.availableVideoQualities?.[0] && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span>Max: {video.availableVideoQualities[0].displayLabel}</span>
                </span>
              )}
            </div>
          </div>

          {video.description && (
            <p className="mt-3 text-xs text-slate-400/80 line-clamp-2 italic">
              "{video.description}"
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
