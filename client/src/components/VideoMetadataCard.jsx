import React, { useState } from 'react';
import {
  Tag,
  Hash,
  Copy,
  Check,
  ExternalLink,
  Image,
  Eye,
  Calendar,
  UserCheck,
  ChevronDown,
  ChevronUp,
  Download,
  Subtitles,
  Sparkles,
  FileText,
  Loader2,
  Link2
} from 'lucide-react';

export default function VideoMetadataCard({ video, onSubtitleDownloaded }) {
  if (!video) return null;

  // Accordion state: COLLAPSED BY DEFAULT as requested
  const [isOpen, setIsOpen] = useState(false);

  // Reusable copy tracking state: key of currently copied item
  const [copiedKey, setCopiedKey] = useState(null);
  const [isDescExpanded, setIsDescExpanded] = useState(false);

  // Subtitle download state
  const [downloadingSubLang, setDownloadingSubLang] = useState(null);
  const [subSuccessMsg, setSubSuccessMsg] = useState(null);

  // Copy helper
  const copyToClipboard = async (text, key) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? null : prev));
      }, 2000);
    } catch (e) {
      console.warn('Clipboard write failed', e);
    }
  };

  // Download high-res thumbnail
  const handleDownloadThumbnail = () => {
    const thumbUrl = video.thumbnail || video.thumbnails?.[video.thumbnails.length - 1]?.url;
    if (!thumbUrl) return;
    const a = document.createElement('a');
    a.href = thumbUrl;
    a.target = '_blank';
    a.download = `${video.title || 'thumbnail'}.jpg`;
    a.click();
  };

  // Download subtitle track
  const handleDownloadSub = async (languageCode, format) => {
    setDownloadingSubLang(`${languageCode}_${format}`);
    setSubSuccessMsg(null);
    try {
      const res = await fetch('/api/download/subtitle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: video.webpageUrl || `https://www.youtube.com/watch?v=${video.id}`,
          languageCode,
          format,
          title: video.title,
          videoId: video.id
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to download subtitle');
      }
      setSubSuccessMsg(`Downloaded ${languageCode.toUpperCase()} (${format.toUpperCase()}) to /downloads/subtitles`);
      if (onSubtitleDownloaded) onSubtitleDownloaded();
      setTimeout(() => setSubSuccessMsg(null), 5000);
    } catch (err) {
      alert(`Error downloading subtitle: ${err.message}`);
    } finally {
      setDownloadingSubLang(null);
    }
  };

  const channel = video.author || {};
  const hasKeywords = video.keywords && video.keywords.length > 0;
  const hasHashtags = video.hashtags && video.hashtags.length > 0;
  const hasSubtitles = video.subtitles && video.subtitles.length > 0;
  const description = video.description || '';

  return (
    <div className="glass-panel rounded-2xl border border-slate-800 shadow-2xl overflow-hidden transition-all duration-300">
      {/* ========================================================= */}
      {/* ACCORDION HEADER (Always visible & clickable to toggle)   */}
      {/* ========================================================= */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left hover:bg-slate-900/60 transition-colors select-none group"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-amber-500/20 to-rose-500/20 border border-amber-500/30 text-amber-400 group-hover:scale-105 transition-transform flex-shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-white group-hover:text-amber-300 transition-colors">
                Video Metadata & SEO Insights
              </h3>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                {isOpen ? 'Click to collapse' : 'Click to expand'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Creator SEO tags, hashtags, full description, channel details, and captions
            </p>
          </div>
        </div>

        {/* Preview Badges & Chevron Toggle Button */}
        <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
          {video.category && (
            <span className="px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
              {video.category}
            </span>
          )}
          {hasKeywords && (
            <span className="px-2 py-0.5 rounded-lg text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
              {video.keywords.length} Tags
            </span>
          )}
          {hasHashtags && (
            <span className="px-2 py-0.5 rounded-lg text-[11px] font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">
              {video.hashtags.length} #tags
            </span>
          )}

          <div className={`p-1.5 rounded-xl bg-slate-800 text-slate-300 group-hover:text-white transition-transform duration-300 ${isOpen ? 'rotate-180 bg-red-500/20 text-red-400' : ''}`}>
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
      </button>

      {/* ========================================================= */}
      {/* ACCORDION CONTENT BODY (Visible when expanded)            */}
      {/* ========================================================= */}
      {isOpen && (
        <div className="p-5 sm:p-6 border-t border-slate-800/80 space-y-6 animate-fadeIn bg-slate-950/40">
          {/* Quick Header Details: Title & URL with Copy Icons */}
          <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800/90 space-y-2">
            {/* Title Copy */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  Video Title
                </span>
                <p className="text-xs sm:text-sm font-semibold text-slate-200 mt-0.5">
                  {video.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(video.title, 'title')}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors flex-shrink-0"
                title="Copy video title"
              >
                {copiedKey === 'title' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 text-[11px]">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span className="text-[11px]">Copy Title</span>
                  </>
                )}
              </button>
            </div>

            {/* URL & ID Copy Row */}
            <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px] truncate">
                <Link2 className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                <span className="truncate">{video.webpageUrl || `https://www.youtube.com/watch?v=${video.id}`}</span>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => copyToClipboard(video.webpageUrl || `https://www.youtube.com/watch?v=${video.id}`, 'url')}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 hover:text-white border border-slate-700 transition-colors flex items-center gap-1"
                >
                  {copiedKey === 'url' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === 'url' ? 'Copied' : 'Copy URL'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => copyToClipboard(video.id, 'id')}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 hover:text-white border border-slate-700 transition-colors flex items-center gap-1 font-mono"
                >
                  {copiedKey === 'id' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === 'id' ? 'Copied' : 'Copy ID'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Grid: Channel Info & Thumbnail Preview */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Channel Details */}
            <div className="md:col-span-7 p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Channel Information
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(channel.name, 'channelName')}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white"
                  title="Copy channel name"
                >
                  {copiedKey === 'channelName' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Name</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-3.5">
                {channel.avatar ? (
                  <img
                    src={channel.avatar}
                    alt={channel.name}
                    className="w-12 h-12 rounded-full object-cover border border-slate-700 shadow-md flex-shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-400 border border-slate-700 flex-shrink-0">
                    {(channel.name || 'C')[0]}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-sm sm:text-base text-white truncate">
                      {channel.name}
                    </span>
                    {channel.verified && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20" title="Verified Creator">
                        <UserCheck className="w-3 h-3" />
                        <span>Verified</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 flex-wrap">
                    {channel.subscriberCountFormatted && (
                      <span>{channel.subscriberCountFormatted} subscribers</span>
                    )}
                    {channel.channelUrl && (
                      <>
                        <span>•</span>
                        <a
                          href={channel.channelUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-red-400 hover:text-red-300 inline-flex items-center gap-1"
                        >
                          <span>Visit Channel</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(channel.channelUrl, 'channelUrl')}
                          className="text-slate-400 hover:text-white"
                          title="Copy channel link"
                        >
                          {copiedKey === 'channelUrl' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Thumbnail Preview & Download */}
            <div className="md:col-span-5 p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Image className="w-3.5 h-3.5 text-amber-400" />
                  <span>Video Thumbnail</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400 px-1.5 py-0.2 rounded bg-slate-800">
                  HD MaxRes
                </span>
              </div>

              <div className="flex items-center gap-3">
                {video.thumbnail && (
                  <img
                    src={video.thumbnail}
                    alt="Thumbnail Preview"
                    className="w-24 h-14 object-cover rounded-lg border border-slate-700 shadow flex-shrink-0"
                  />
                )}
                <div className="min-w-0 flex-1 space-y-1.5">
                  <button
                    type="button"
                    onClick={handleDownloadThumbnail}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold border border-slate-700/60 transition-all shadow"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-400" />
                    <span>Download Thumbnail</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(video.thumbnail, 'thumbUrl')}
                    className="w-full flex items-center justify-center gap-1 text-[11px] text-slate-400 hover:text-white"
                  >
                    {copiedKey === 'thumbUrl' ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied Image URL</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy Image URL</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Video SEO Tags / Keywords */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-emerald-400" />
                <span className="text-xs sm:text-sm font-bold text-slate-200">
                  Video Tags & SEO Keywords
                </span>
                <span className="px-2 py-0.2 rounded-full text-xs font-semibold bg-slate-800 text-slate-400">
                  {video.keywords?.length || 0}
                </span>
              </div>

              {hasKeywords && (
                <button
                  type="button"
                  onClick={() => copyToClipboard(video.keywords.join(', '), 'allTags')}
                  className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium rounded-lg border border-slate-700 transition-all"
                >
                  {copiedKey === 'allTags' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">All Tags Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy All Tags</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {hasKeywords ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {video.keywords.map((kw, idx) => {
                  const tagKey = `tag_${idx}`;
                  const isCopied = copiedKey === tagKey;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => copyToClipboard(kw, tagKey)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${
                        isCopied
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-slate-800/90 hover:bg-slate-700 text-slate-300 border-slate-700/60 hover:text-white'
                      }`}
                      title="Click to copy this tag"
                    >
                      <span>{kw}</span>
                      {isCopied ? (
                        <Check className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                      ) : (
                        <Copy className="w-3 h-3 text-slate-500 opacity-60 hover:opacity-100 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic pt-1">
                No creator tags or SEO keywords specified on this video.
              </p>
            )}
          </div>

          {/* Video Hashtags */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-sky-400" />
                <span className="text-xs sm:text-sm font-bold text-slate-200">
                  Video Hashtags
                </span>
                <span className="px-2 py-0.2 rounded-full text-xs font-semibold bg-slate-800 text-slate-400">
                  {video.hashtags?.length || 0}
                </span>
              </div>

              {hasHashtags && (
                <button
                  type="button"
                  onClick={() => copyToClipboard(video.hashtags.join(' '), 'allHashtags')}
                  className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium rounded-lg border border-slate-700 transition-all"
                >
                  {copiedKey === 'allHashtags' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-sky-400" />
                      <span className="text-sky-400">Hashtags Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy All Hashtags</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {hasHashtags ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {video.hashtags.map((ht, idx) => {
                  const htKey = `ht_${idx}`;
                  const isCopied = copiedKey === htKey;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => copyToClipboard(ht, htKey)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border ${
                        isCopied
                          ? 'bg-sky-500/25 text-sky-300 border-sky-400'
                          : 'bg-sky-500/10 text-sky-400 border-sky-500/20 hover:bg-sky-500/20'
                      }`}
                      title="Click to copy this hashtag"
                    >
                      <span>{ht}</span>
                      {isCopied ? (
                        <Check className="w-3 h-3 text-sky-300 flex-shrink-0" />
                      ) : (
                        <Copy className="w-3 h-3 text-sky-400/60 opacity-60 hover:opacity-100 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic pt-1">
                No hashtags found in video title or description.
              </p>
            )}
          </div>

          {/* Captions & Closed Captions List */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Subtitles className="w-4 h-4 text-emerald-400" />
                <span className="text-xs sm:text-sm font-bold text-slate-200">
                  Captions & Subtitle Tracks ({video.subtitles?.length || 0} Available)
                </span>
              </div>

              {subSuccessMsg && (
                <span className="text-xs text-emerald-400 font-mono animate-fadeIn">
                  ✓ {subSuccessMsg}
                </span>
              )}
            </div>

            {hasSubtitles ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1 pt-1">
                {video.subtitles.map((sub, idx) => {
                  const srtKey = `${sub.languageCode}_srt`;
                  const vttKey = `${sub.languageCode}_vtt`;
                  const isDownloadingSrt = downloadingSubLang === srtKey;
                  const isDownloadingVtt = downloadingSubLang === vttKey;

                  return (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-slate-850 border border-slate-750 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-200 truncate" title={sub.languageName}>
                          {sub.languageName}
                        </p>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {sub.languageCode} • {sub.isAutoGenerated ? 'Auto' : 'Official'}
                        </span>
                      </div>

                      {/* SRT and VTT download buttons */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleDownloadSub(sub.languageCode, 'srt')}
                          disabled={Boolean(downloadingSubLang)}
                          className="px-2 py-1 text-[10px] font-bold bg-slate-800 hover:bg-emerald-600 hover:text-white text-emerald-400 rounded-md border border-slate-700 transition-colors"
                          title="Download .SRT"
                        >
                          {isDownloadingSrt ? <Loader2 className="w-3 h-3 animate-spin" /> : '.SRT'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadSub(sub.languageCode, 'vtt')}
                          disabled={Boolean(downloadingSubLang)}
                          className="px-2 py-1 text-[10px] font-bold bg-slate-800 hover:bg-emerald-600 hover:text-white text-emerald-400 rounded-md border border-slate-700 transition-colors"
                          title="Download .VTT"
                        >
                          {isDownloadingVtt ? <Loader2 className="w-3 h-3 animate-spin" /> : '.VTT'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic pt-1">
                No closed captions or subtitles available for this video.
              </p>
            )}
          </div>

          {/* Full Description Section */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>Full Video Description</span>
              </span>

              <div className="flex items-center gap-2">
                {description && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(description, 'desc')}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-white font-medium"
                    title="Copy full description text"
                  >
                    {copiedKey === 'desc' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 text-[11px]">Description Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span className="text-[11px]">Copy Description</span>
                      </>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsDescExpanded(!isDescExpanded)}
                  className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 font-semibold ml-2"
                >
                  <span>{isDescExpanded ? 'Show Less' : 'Show Full'}</span>
                  {isDescExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className={`text-xs text-slate-300 font-sans whitespace-pre-line leading-relaxed transition-all ${
              isDescExpanded ? 'max-h-none' : 'max-h-20 overflow-hidden relative'
            }`}>
              {description || 'No description provided.'}
              {!isDescExpanded && description.length > 200 && (
                <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-slate-900/90 to-transparent pointer-events-none" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
