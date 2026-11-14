import React, { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar.jsx';
import UrlInput from './components/UrlInput.jsx';
import VideoCard from './components/VideoCard.jsx';
import FormatSelector from './components/FormatSelector.jsx';
import DownloadProgress from './components/DownloadProgress.jsx';
import DownloadedList from './components/DownloadedList.jsx';
import { Sparkles, Play, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [url, setUrl] = useState('');
  const [videoInfo, setVideoInfo] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);

  const [currentJob, setCurrentJob] = useState(null);
  const [downloadedFiles, setDownloadedFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  const sseRef = useRef(null);
  const pollingRef = useRef(null);

  // Load existing downloaded files on mount
  useEffect(() => {
    fetchDownloadedFiles();
    return () => {
      cleanupProgressTracking();
    };
  }, []);

  const cleanupProgressTracking = () => {
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const fetchDownloadedFiles = async () => {
    try {
      setLoadingFiles(true);
      const res = await fetch('/api/files');
      const data = await res.json();
      if (data.ok) {
        setDownloadedFiles(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch files:', err);
    } finally {
      setLoadingFiles(false);
    }
  };

  // 1. Analyze video URL
  const handleAnalyze = async (targetUrl) => {
    setAnalyzing(true);
    setAnalysisError(null);
    setVideoInfo(null);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl })
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to analyze video');
      }

      setVideoInfo(data.data);
    } catch (err) {
      console.error('Analyze error:', err);
      setAnalysisError(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  // 2. Start download
  const handleDownload = async (options) => {
    cleanupProgressTracking();

    const payload = {
      ...options,
      url: options.url || videoInfo?.webpageUrl || url
    };

    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to start download');
      }

      const jobId = data.jobId;
      setCurrentJob({
        jobId,
        status: 'starting',
        percent: '0%',
        speed: '--',
        eta: '--',
        totalSize: '--',
        message: 'Initializing download stream...'
      });

      // Scroll smoothly down to progress indicator
      setTimeout(() => {
        document.getElementById('progress-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

      // Start SSE for live real-time progress updates
      setupProgressStream(jobId);

    } catch (err) {
      console.error('Download start error:', err);
      setCurrentJob({
        status: 'error',
        error: err.message
      });
    }
  };

  const setupProgressStream = (jobId) => {
    try {
      const eventSource = new EventSource(`/api/download/progress/${jobId}`);
      sseRef.current = eventSource;

      eventSource.onmessage = (e) => {
        try {
          const update = JSON.parse(e.data);
          setCurrentJob(update);

          if (update.status === 'completed' || update.status === 'error' || update.status === 'cancelled') {
            eventSource.close();
            sseRef.current = null;
            if (update.status === 'completed') {
              fetchDownloadedFiles();
            }
          }
        } catch (err) {
          console.error('Error parsing SSE message:', err);
        }
      };

      eventSource.onerror = () => {
        // Fallback to polling if SSE encounters an issue
        console.warn('SSE disconnected, falling back to polling');
        eventSource.close();
        sseRef.current = null;
        startPolling(jobId);
      };
    } catch (err) {
      startPolling(jobId);
    }
  };

  const startPolling = (jobId) => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/download/status/${jobId}`);
        const data = await res.json();
        if (data.ok && data.data) {
          setCurrentJob(data.data);
          if (['completed', 'error', 'cancelled'].includes(data.data.status)) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
            if (data.data.status === 'completed') {
              fetchDownloadedFiles();
            }
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 1000);
  };

  // 3. Cancel download
  const handleCancelDownload = async (jobId) => {
    try {
      await fetch(`/api/download/cancel/${jobId}`, { method: 'POST' });
      cleanupProgressTracking();
      setCurrentJob(prev => prev ? { ...prev, status: 'cancelled', message: 'Cancelled by user' } : null);
    } catch (err) {
      console.error('Error cancelling job:', err);
    }
  };

  // 4. Open downloads folder in Windows Explorer
  const handleOpenFolder = async () => {
    try {
      await fetch('/api/files/open-folder', { method: 'POST' });
    } catch (err) {
      console.error('Failed to open folder:', err);
    }
  };

  // 5. Delete file
  const handleDeleteFile = async (fileName) => {
    if (!window.confirm(`Are you sure you want to delete "${fileName}"?`)) return;
    try {
      const res = await fetch(`/api/files/${encodeURIComponent(fileName)}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.ok) {
        fetchDownloadedFiles();
      }
    } catch (err) {
      console.error('Failed to delete file:', err);
    }
  };

  // 6. Direct browser download of saved file
  const handleDownloadFile = (fileName) => {
    window.location.href = `/api/files/download/${encodeURIComponent(fileName)}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col relative overflow-x-hidden">
      {/* Background radial glow effect */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-b from-red-600/15 via-rose-600/5 to-transparent blur-3xl pointer-events-none -z-10" />

      {/* Top Navigation */}
      <Navbar
        onOpenFolder={handleOpenFolder}
        downloadCount={downloadedFiles.length}
      />

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 sm:py-12 flex flex-col gap-8">
        {/* Hero Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Select Video Quality, Multi-Language Audio & Mode</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
            Download YouTube Videos <br />
            <span className="bg-gradient-to-r from-red-500 via-rose-400 to-amber-300 bg-clip-text text-transparent">
              In Any Quality & Language
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto">
            Analyze any YouTube video, choose your preferred video resolution (up to 4K), 
            select from all available audio languages, and download video, audio, or both.
          </p>
        </div>

        {/* URL Input Box */}
        <UrlInput
          url={url}
          setUrl={setUrl}
          onAnalyze={handleAnalyze}
          loading={analyzing}
          error={analysisError}
          setError={setAnalysisError}
        />

        {/* Video Preview Card */}
        {videoInfo && (
          <div className="animate-fadeIn space-y-6">
            <VideoCard video={videoInfo} />

            {/* Customizer / Quality & Audio Language Selector */}
            <FormatSelector
              video={videoInfo}
              onDownload={handleDownload}
              downloading={currentJob && ['starting', 'downloading', 'merging'].includes(currentJob.status)}
            />
          </div>
        )}

        {/* Live Download Progress Card */}
        {currentJob && (
          <div id="progress-section" className="animate-fadeIn">
            <DownloadProgress
              job={currentJob}
              onCancel={handleCancelDownload}
              onOpenFolder={handleOpenFolder}
              onDownloadFile={handleDownloadFile}
            />
          </div>
        )}

        {/* Downloaded Files Gallery / List */}
        <div className="mt-2">
          <DownloadedList
            files={downloadedFiles}
            onRefresh={fetchDownloadedFiles}
            onDelete={handleDeleteFile}
            onDownloadFile={handleDownloadFile}
            onOpenFolder={handleOpenFolder}
            loading={loadingFiles}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© 2026 StreamVault • Full-stack YouTube Downloader</p>
          <p className="flex items-center gap-2">
            <span>Powered by Node.js</span>
            <span>•</span>
            <span>React + Vite</span>
            <span>•</span>
            <span>Tailwind CSS</span>
            <span>•</span>
            <span>FFmpeg</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
