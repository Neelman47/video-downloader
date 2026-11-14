import React, { useState, useEffect, useMemo } from 'react';
import {
  Mic,
  Volume2,
  Sparkles,
  Layers,
  FolderOpen,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Info,
  ChevronDown,
  ChevronUp,
  Key,
  Globe,
  Sliders,
  Play,
  RotateCcw,
  UploadCloud,
  Check,
  Copy,
  FileText,
  Music,
  User,
  Wand2,
  Radio,
  ExternalLink
} from 'lucide-react';

const TONES_LIST = [
  {
    id: 'conversational',
    label: 'Conversational',
    desc: 'Friendly everyday speech for vlogs, podcasts & dialogue',
    icon: '💬',
    rate: '+0%',
    pitch: '+0Hz'
  },
  {
    id: 'professional',
    label: 'Professional / News',
    desc: 'Clear, steady, authoritative delivery for tutorials & presentations',
    icon: '🎙️',
    rate: '-4%',
    pitch: '-2Hz'
  },
  {
    id: 'energetic',
    label: 'Energetic / Storyteller',
    desc: 'Upbeat, expressive, dynamic pacing for entertainment & shorts',
    icon: '⚡',
    rate: '+14%',
    pitch: '+4Hz'
  },
  {
    id: 'calm',
    label: 'Calm / Audiobook',
    desc: 'Soothing, relaxed, gentle cadence for storytelling & meditation',
    icon: '🌿',
    rate: '-10%',
    pitch: '-3Hz'
  }
];

const SAMPLE_TEXTS = {
  en: "Welcome back to our channel! In today's video, we are exploring the future of artificial intelligence and voice technology.",
  hi: "हमारे चैनल में आपका स्वागत है! आज के इस वीडियो में हम आर्टिफिशियल इंटेलिजेंस और वॉयस टेक्नोलॉजी के बारे में जानेंगे।",
  gu: "અમારી ચેનલમાં તમારું સ્વાગત છે! આજના વિડિયોમાં આપણે આર્ટિફિશિયલ ઇન્ટેલિજન્સ અને વોઇસ ટેકનોલોજી વિશે જાણીશું."
};

export default function VoiceStudio({
  files = [],
  onOpenFolder,
  onDownloadFile,
  onRefreshFiles
}) {
  // Navigation inside Voice Studio: 'dubbing' | 'tts'
  const [subTab, setSubTab] = useState('dubbing');

  // System capabilities from backend
  const [sysStatus, setSysStatus] = useState({
    demucsAvailable: false,
    pythonAvailable: false,
    hasGeminiKey: false,
    supportedVoices: {},
    tones: {}
  });

  // Collapsible Info Box
  const [showInfoBox, setShowInfoBox] = useState(true);

  // API Key Settings Modal
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem('sv_gemini_api_key') || '');
  const [keySavedMsg, setKeySavedMsg] = useState(false);

  // Audio only vs include videos filter
  const [audioOnlyFilter, setAudioOnlyFilter] = useState(true);

  // Available audio files from library
  const availableAudioFiles = useMemo(() => {
    return files.filter((f) => {
      if (audioOnlyFilter) {
        return ['audio', 'dubbed', 'tts'].includes(f.category) || (f.type === 'audio' && f.type !== 'video');
      }
      return ['audio', 'videos', 'clips', 'dubbed', 'tts'].includes(f.category) || f.type === 'audio' || f.type === 'video';
    });
  }, [files, audioOnlyFilter]);

  // =========================================================
  // SUB-TAB 1: AI DUBBER STATE
  // =========================================================
  const [dubInputMode, setDubInputMode] = useState('library'); // 'library' | 'upload'
  const [selectedAudioPath, setSelectedAudioPath] = useState('');
  const [uploadedAudioFile, setUploadedAudioFile] = useState(null);
  const [targetLang, setTargetLang] = useState('hi'); // 'hi' | 'gu'
  const [dubGender, setDubGender] = useState('auto'); // 'auto' | 'male' | 'female'
  const [separationMode, setSeparationMode] = useState('auto'); // 'auto' | 'demucs' | 'pure_voice' | 'ffmpeg_filter'
  const [customDubName, setCustomDubName] = useState('');
  const [dubTranscript, setDubTranscript] = useState('');
  const [showTranscriptBox, setShowTranscriptBox] = useState(false);
  const [bgMusicVolume, setBgMusicVolume] = useState(100); // 50% - 150%
  const [startOffsetSec, setStartOffsetSec] = useState(''); // empty = auto-detect
  const [vocalCutIntensity, setVocalCutIntensity] = useState('max'); // 'max' | 'balanced'

  // Sync initial selected path
  useEffect(() => {
    if (!selectedAudioPath && availableAudioFiles.length > 0) {
      setSelectedAudioPath(availableAudioFiles[0].relativePath || availableAudioFiles[0].name);
    }
  }, [availableAudioFiles, selectedAudioPath]);

  const [isDubbing, setIsDubbing] = useState(false);
  const [dubProgress, setDubProgress] = useState({ percent: '0%', message: '' });
  const [activeDubJobId, setActiveDubJobId] = useState(null);
  const [dubResult, setDubResult] = useState(null);
  const [dubError, setDubError] = useState(null);

  // =========================================================
  // SUB-TAB 2: TEXT TO SPEECH (TTS) STATE
  // =========================================================
  const [ttsText, setTtsText] = useState(SAMPLE_TEXTS.en);
  const [ttsLang, setTtsLang] = useState('en'); // 'en' | 'hi' | 'gu'
  const [ttsGender, setTtsGender] = useState('male'); // 'male' | 'female'
  const [ttsTone, setTtsTone] = useState('conversational');
  const [ttsSpeed, setTtsSpeed] = useState(1.0);
  const [ttsPitch, setTtsPitch] = useState(0);
  const [customTtsName, setCustomTtsName] = useState('');

  const [isGeneratingTts, setIsGeneratingTts] = useState(false);
  const [ttsResult, setTtsResult] = useState(null);
  const [ttsError, setTtsError] = useState(null);

  // Copy helper
  const [copiedCmd, setCopiedCmd] = useState(false);

  useEffect(() => {
    fetchSystemStatus();
  }, []);

  const fetchSystemStatus = async () => {
    try {
      const res = await fetch('/api/voice/status');
      const data = await res.json();
      if (data.ok && data.data) {
        setSysStatus(data.data);
      }
    } catch (e) {
      console.error('Failed to fetch voice status:', e);
    }
  };

  const handleSaveApiKey = () => {
    localStorage.setItem('sv_gemini_api_key', geminiApiKey.trim());
    setKeySavedMsg(true);
    setTimeout(() => {
      setKeySavedMsg(false);
      setShowKeyModal(false);
    }, 1200);
  };

  const handleCopyInstallCmd = () => {
    navigator.clipboard.writeText('pip install demucs');
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  // ---------------------------------------------------------
  // Feature 1 Handler: AI Voice Dubbing
  // ---------------------------------------------------------
  const handleStartDubbing = async () => {
    setDubError(null);
    setDubResult(null);

    if (dubInputMode === 'library' && !selectedAudioPath) {
      return setDubError('Please select an audio file from your library or upload one.');
    }
    if (dubInputMode === 'upload' && !uploadedAudioFile) {
      return setDubError('Please choose an audio or video file from your computer.');
    }

    setIsDubbing(true);
    setDubProgress({ percent: '5%', message: 'Initializing AI Audio Dubber pipeline...' });

    try {
      const formData = new FormData();
      formData.append('targetLanguage', targetLang);
      formData.append('voiceGender', dubGender);
      formData.append('separationMode', separationMode);
      if (customDubName.trim()) {
        formData.append('outputName', customDubName.trim());
      }
      if (dubTranscript.trim()) {
        formData.append('transcriptText', dubTranscript.trim());
      }
      formData.append('bgVolume', (bgMusicVolume / 100).toString());
      if (startOffsetSec.toString().trim() !== '') {
        formData.append('startOffset', startOffsetSec.toString().trim());
      }
      formData.append('vocalCutLevel', vocalCutIntensity);

      const storedKey = localStorage.getItem('sv_gemini_api_key');
      if (storedKey) {
        formData.append('apiKey', storedKey);
      }

      if (dubInputMode === 'upload' && uploadedAudioFile) {
        formData.append('audioFile', uploadedAudioFile);
      } else {
        formData.append('inputAudioPath', selectedAudioPath);
      }

      const res = await fetch('/api/voice/dub', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to start dubbing job');
      }

      const jobId = data.jobId;
      setActiveDubJobId(jobId);

      // Start SSE tracking
      const eventSource = new EventSource(`/api/download/progress/${jobId}`);

      eventSource.onmessage = (e) => {
        try {
          const update = JSON.parse(e.data);
          setDubProgress({
            percent: update.percent || '45%',
            message: update.message || 'Processing audio dubbing...'
          });

          if (update.status === 'completed') {
            eventSource.close();
            setIsDubbing(false);
            setDubResult(update);
            if (onRefreshFiles) onRefreshFiles();
          } else if (update.status === 'error' || update.status === 'cancelled') {
            eventSource.close();
            setIsDubbing(false);
            setDubError(update.error || 'Dubbing failed');
          }
        } catch (err) {
          console.error('Error parsing SSE dub progress:', err);
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        pollDubStatus(jobId);
      };

    } catch (err) {
      console.error('Dubbing error:', err);
      setIsDubbing(false);
      setDubError(err.message || 'Dubbing failed to start');
    }
  };

  const pollDubStatus = (jobId) => {
    const poller = setInterval(async () => {
      try {
        const res = await fetch(`/api/download/status/${jobId}`);
        const data = await res.json();
        if (data.ok && data.data) {
          setDubProgress({
            percent: data.data.percent || '60%',
            message: data.data.message || 'Processing dubbing...'
          });

          if (data.data.status === 'completed') {
            clearInterval(poller);
            setIsDubbing(false);
            setDubResult(data.data);
            if (onRefreshFiles) onRefreshFiles();
          } else if (data.data.status === 'error' || data.data.status === 'cancelled') {
            clearInterval(poller);
            setIsDubbing(false);
            setDubError(data.data.error || 'Dubbing failed');
          }
        }
      } catch (e) {
        clearInterval(poller);
        setIsDubbing(false);
      }
    }, 1500);
  };

  const handleCancelDubbing = async () => {
    if (!activeDubJobId) return;
    try {
      await fetch(`/api/voice/cancel/${activeDubJobId}`, { method: 'POST' });
      setIsDubbing(false);
      setDubError('Dubbing cancelled by user');
    } catch (e) {}
  };

  // ---------------------------------------------------------
  // Feature 2 Handler: Text-to-Speech (TTS)
  // ---------------------------------------------------------
  const handleGenerateTTS = async () => {
    setTtsError(null);
    setTtsResult(null);

    if (!ttsText.trim()) {
      return setTtsError('Please enter some text to generate speech');
    }

    setIsGeneratingTts(true);

    try {
      const res = await fetch('/api/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: ttsText.trim(),
          language: ttsLang,
          gender: ttsGender,
          tone: ttsTone,
          speed: ttsSpeed,
          pitch: ttsPitch,
          outputName: customTtsName.trim()
        })
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to generate speech');
      }

      setTtsResult(data.data);
      if (onRefreshFiles) onRefreshFiles();
    } catch (err) {
      console.error('TTS error:', err);
      setTtsError(err.message || 'Failed to synthesize speech');
    } finally {
      setIsGeneratingTts(false);
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-5 sm:p-7 border border-slate-800 shadow-2xl space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20 shadow-lg shadow-violet-500/10">
            <Mic className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-white">Dubbing & Voice Studio</h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-violet-500/10 text-violet-300 border border-violet-500/20 uppercase">
                AI Neural Speech
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Convert English audio into Hindi or Gujarati with background music preserved, or synthesize studio-quality speech from text
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Free API Key Settings */}
          <button
            type="button"
            onClick={() => setShowKeyModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 bg-slate-850 hover:bg-slate-800 rounded-xl border border-slate-700/60 transition-all hover:text-white"
            title="Configure Free Gemini / Groq API Key"
          >
            <Key className="w-3.5 h-3.5 text-violet-400" />
            <span>{geminiApiKey ? 'API Key Configured ✓' : 'Add Free API Key'}</span>
          </button>

          {/* Open Dubbed/TTS Folder */}
          <button
            type="button"
            onClick={() => onOpenFolder(subTab === 'dubbing' ? 'dubbed_audio' : 'tts_audio')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all border border-slate-700/50 shadow"
          >
            <FolderOpen className="w-4 h-4 text-amber-400" />
            <span>Open {subTab === 'dubbing' ? 'dubbed_audio' : 'tts_audio'}</span>
          </button>
        </div>
      </div>

      {/* COLLAPSIBLE INFO BOX: Engines in Use & Future Roadmap */}
      <div className="rounded-xl border border-violet-500/25 bg-gradient-to-r from-violet-950/20 via-slate-900/40 to-slate-950 overflow-hidden shadow-lg">
        <div
          onClick={() => setShowInfoBox(!showInfoBox)}
          className="flex items-center justify-between p-3.5 cursor-pointer hover:bg-slate-800/40 transition-colors select-none"
        >
          <div className="flex items-center gap-2.5">
            <Info className="w-4 h-4 text-violet-400 flex-shrink-0" />
            <span className="text-xs sm:text-sm font-bold text-slate-200">
              Active Engines, Models in Use & Upcoming Options
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>{showInfoBox ? 'Hide Details' : 'Show Details'}</span>
            {showInfoBox ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>

        {showInfoBox && (
          <div className="p-4 pt-1 border-t border-slate-800/60 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs animate-fadeIn">
            {/* Left Column: What We Are Using Now */}
            <div className="space-y-2 p-3 rounded-lg bg-slate-900/60 border border-slate-800">
              <span className="font-bold text-violet-300 uppercase tracking-wide flex items-center gap-1.5 text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Currently Active in StreamVault:</span>
              </span>
              <ul className="space-y-1.5 text-slate-300 text-[11px]">
                <li className="flex items-start gap-1.5">
                  <span className="text-violet-400 font-bold">•</span>
                  <span><strong>Voice Synthesis Engine:</strong> Microsoft Edge Neural Speech (100% Free, Zero API Key required) with natural Hindi (Madhur / Swara) and Gujarati (Niranjan / Dhwani) voices.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-violet-400 font-bold">•</span>
                  <span><strong>Translation & Transcription:</strong> Powered by Free Google Gemini API / Groq Whisper, with instant fallback to free Google Translate.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-violet-400 font-bold">•</span>
                  <span><strong>Vocal & Background Separation:</strong> Python Demucs neural stem separator (preserves background music, instruments & SFX) + FFmpeg Smart Ducking.</span>
                </li>
              </ul>
            </div>

            {/* Right Column: Roadmap & Options for Later */}
            <div className="space-y-2 p-3 rounded-lg bg-slate-900/60 border border-slate-800">
              <span className="font-bold text-amber-300 uppercase tracking-wide flex items-center gap-1.5 text-[11px]">
                <Wand2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Planned Options for Later (Roadmap):</span>
              </span>
              <ul className="space-y-1.5 text-slate-400 text-[11px]">
                <li className="flex items-start gap-1.5">
                  <span className="text-amber-400 font-bold">1.</span>
                  <span><strong>100% Offline Local Whisper:</strong> Run Speech-to-Text entirely offline without any external cloud API key.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-amber-400 font-bold">2.</span>
                  <span><strong>Zero-Shot Voice Cloning:</strong> Clone and clone-match the speaker's exact timbre and vocal character in Hindi & Gujarati.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-amber-400 font-bold">3.</span>
                  <span><strong>Multi-Speaker Diarization:</strong> Detect multiple different speakers in podcast/interview and assign unique voices to each.</span>
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Main Sub-Tab Switcher */}
      <div className="flex rounded-xl bg-slate-900 p-1 border border-slate-800">
        <button
          type="button"
          onClick={() => setSubTab('dubbing')}
          className={`flex-1 py-2.5 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
            subTab === 'dubbing'
              ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Mic className="w-4 h-4" />
          <span>1. AI Voice Dubber (English ➔ Hindi / Gujarati)</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('tts')}
          className={`flex-1 py-2.5 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
            subTab === 'tts'
              ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Volume2 className="w-4 h-4" />
          <span>2. Text-to-Speech Studio (Male / Female Tones)</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: AI VOICE DUBBING PIPELINE                          */}
      {/* ========================================================= */}
      {subTab === 'dubbing' && (
        <div className="space-y-5 animate-fadeIn">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* SLOT 1: INPUT AUDIO */}
            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    <Music className="w-4 h-4 text-violet-400" />
                    <span>1. Input English Audio</span>
                  </span>
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20">
                    Required
                  </span>
                </div>

                {/* Input source toggle */}
                <div className="flex rounded-lg bg-slate-800 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setDubInputMode('library')}
                    className={`flex-1 py-1 rounded-md font-semibold transition-all ${
                      dubInputMode === 'library' ? 'bg-violet-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    From Library ({availableAudioFiles.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDubInputMode('upload')}
                    className={`flex-1 py-1 rounded-md font-semibold transition-all ${
                      dubInputMode === 'upload' ? 'bg-violet-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Upload PC File
                  </button>
                </div>

                {dubInputMode === 'library' ? (
                  <div className="space-y-2">
                    <select
                      value={selectedAudioPath}
                      onChange={(e) => setSelectedAudioPath(e.target.value)}
                      className="w-full bg-slate-800 text-slate-200 text-xs p-2.5 rounded-xl border border-slate-700 outline-none focus:border-violet-500"
                    >
                      {availableAudioFiles.length === 0 ? (
                        <option value="">No media files found</option>
                      ) : (
                        availableAudioFiles.map((f) => (
                          <option key={f.relativePath || f.name} value={f.relativePath || f.name}>
                            {f.name} ({f.sizeFormatted})
                          </option>
                        ))
                      )}
                    </select>

                    <label className="flex items-center gap-2 text-[11px] text-slate-400 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={audioOnlyFilter}
                        onChange={(e) => setAudioOnlyFilter(e.target.checked)}
                        className="rounded bg-slate-800 border-slate-700 text-violet-500 focus:ring-0"
                      />
                      <span>Only show audio files (uncheck to include video files)</span>
                    </label>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-700 hover:border-violet-500/70 rounded-xl cursor-pointer bg-slate-850/40 hover:bg-slate-800/50 transition-all text-center">
                      <UploadCloud className="w-6 h-6 text-slate-400 mb-1" />
                      <span className="text-xs text-slate-300 font-medium truncate max-w-[200px]">
                        {uploadedAudioFile ? uploadedAudioFile.name : 'Choose audio/video file'}
                      </span>
                      <span className="text-[10px] text-slate-500 mt-0.5">MP3, WAV, M4A, MP4</span>
                      <input
                        type="file"
                        accept="audio/*,video/*,.mp3,.wav,.m4a,.mp4,.webm"
                        onChange={(e) => setUploadedAudioFile(e.target.files[0] || null)}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>

              <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-800">
                Primary English voice source to be dubbed
              </div>
            </div>

            {/* SLOT 2: TARGET LANGUAGE & VOICE GENDER */}
            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-emerald-400" />
                    <span>2. Target Language</span>
                  </span>
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Neural
                  </span>
                </div>

                {/* Target Language Selector */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setTargetLang('hi')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      targetLang === 'hi'
                        ? 'bg-emerald-500/10 border-emerald-500 text-white shadow'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="font-bold flex items-center justify-between">
                      <span>Hindi (हिंदी)</span>
                      {targetLang === 'hi' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">Madhur / Swara Neural</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetLang('gu')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      targetLang === 'gu'
                        ? 'bg-emerald-500/10 border-emerald-500 text-white shadow'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="font-bold flex items-center justify-between">
                      <span>Gujarati (ગુજરાતી)</span>
                      {targetLang === 'gu' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">Niranjan / Dhwani Neural</p>
                  </button>
                </div>

                {/* Voice Gender */}
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 font-semibold flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>Voice Gender:</span>
                  </label>
                  <div className="flex rounded-lg bg-slate-800 p-0.5 text-xs">
                    {[
                      { id: 'auto', label: 'Auto Detect' },
                      { id: 'male', label: 'Male' },
                      { id: 'female', label: 'Female' }
                    ].map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setDubGender(g.id)}
                        className={`flex-1 py-1 rounded-md font-semibold transition-all ${
                          dubGender === g.id
                            ? 'bg-emerald-500 text-slate-950 shadow'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-emerald-400/90 pt-2 border-t border-slate-800">
                Natural intonation matching conversational rhythm
              </div>
            </div>

            {/* SLOT 3: STEM SEPARATION & BACKGROUND MUSIC */}
            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-amber-400" />
                    <span>3. Background Music Retention</span>
                  </span>
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Demucs AI
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 cursor-pointer hover:bg-slate-800 transition-all">
                    <input
                      type="radio"
                      name="sepMode"
                      value="auto"
                      checked={separationMode === 'auto'}
                      onChange={() => setSeparationMode('auto')}
                      className="mt-0.5 accent-amber-500"
                    />
                    <div>
                      <span className="font-semibold text-slate-200 block">Automatic Demucs Separation</span>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Separates vocals from music. Keeps music & SFX intact and ducks volume while speech plays.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 cursor-pointer hover:bg-slate-800 transition-all">
                    <input
                      type="radio"
                      name="sepMode"
                      value="pure_voice"
                      checked={separationMode === 'pure_voice'}
                      onChange={() => setSeparationMode('pure_voice')}
                      className="mt-0.5 accent-amber-500"
                    />
                    <div>
                      <span className="font-semibold text-slate-200 block">Pure Voice / Speech Only</span>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Input audio has no background music (e.g. podcast or vocal memo). Skips stem isolation.
                      </p>
                    </div>
                  </label>
                </div>

                {/* Background Music Volume Slider */}
                {separationMode !== 'pure_voice' && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-800">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-300 font-semibold">Background Music Volume:</span>
                      <span className="font-mono text-amber-400 font-bold">{bgMusicVolume}%</span>
                    </div>
                    <input
                      type="range"
                      min="30"
                      max="150"
                      step="5"
                      value={bgMusicVolume}
                      onChange={(e) => setBgMusicVolume(Number(e.target.value))}
                      className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                    <p className="text-[10px] text-slate-400">
                      100% full original music & sound effects during intro, fight scenes & climax; dynamically ducks during spoken dialogue.
                    </p>
                  </div>
                )}

                {/* Subtitle / Timestamp Sync Indicator */}
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300 space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-emerald-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Exact Scene-Time Synchronization</span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Characters speak at the exact second their dialogue occurs in the video. All pauses, music, and fight sounds stay 100% original.
                  </p>
                </div>

                {/* Demucs status notice */}
                {!sysStatus.demucsAvailable && separationMode === 'auto' && (
                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Local Python Demucs: Not installed</span>
                      <button
                        type="button"
                        onClick={handleCopyInstallCmd}
                        className="text-[10px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 px-1.5 py-0.5 rounded border border-amber-500/30 flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{copiedCmd ? 'Copied!' : 'pip install demucs'}</span>
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Falls back to FFmpeg vocal attenuation if Demucs is not installed.
                    </p>
                  </div>
                )}
              </div>

              <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-800">
                Saves to: <code className="text-amber-400 font-mono">/downloads/dubbed_audio</code>
              </div>
            </div>
          </div>

          {/* Optional Output Name */}
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <span className="text-slate-400 whitespace-nowrap">Output Name (Optional):</span>
              <input
                type="text"
                value={customDubName}
                onChange={(e) => setCustomDubName(e.target.value)}
                placeholder="e.g. final_hindi_dub"
                className="w-full bg-slate-800 text-slate-200 px-3 py-1.5 rounded-xl border border-slate-700 outline-none focus:border-violet-500"
              />
            </div>

            <div className="text-slate-400 font-mono text-[11px]">
              Destination: <strong className="text-violet-400">/downloads/dubbed_audio</strong>
            </div>
          </div>

          {/* Error Alert */}
          {dubError && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center justify-between gap-3 animate-fadeIn">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{dubError}</span>
              </div>
              <button onClick={() => setDubError(null)} className="text-red-400 hover:text-white">
                Dismiss
              </button>
            </div>
          )}

          {/* Live Progress Bar */}
          {isDubbing && (
            <div className="p-5 rounded-xl bg-slate-900/90 border border-violet-500/30 space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between text-xs text-slate-200">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
                  <span className="font-semibold text-violet-300">{dubProgress.message}</span>
                </div>
                <span className="font-mono font-bold text-violet-400">{dubProgress.percent}</span>
              </div>

              <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-violet-500 via-indigo-500 to-emerald-500 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: dubProgress.percent }}
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleCancelDubbing}
                  className="px-3 py-1 text-xs text-slate-400 hover:text-red-400 rounded-lg transition-colors"
                >
                  Cancel Dubbing
                </button>
              </div>
            </div>
          )}

          {/* Completed Card with Interactive Audio Player */}
          {dubResult && (
            <div className="p-5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-4 animate-fadeIn">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 text-emerald-400">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-bold text-white">Audio Dubbed Successfully!</h4>
                    <p className="text-xs text-emerald-300/90 mt-0.5">
                      Output saved to <code className="font-mono text-white">/downloads/dubbed_audio/{dubResult.fileName}</code> ({dubResult.fileSizeFormatted})
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setDubResult(null)}
                  className="text-xs text-slate-400 hover:text-white px-2 py-1"
                >
                  Dismiss
                </button>
              </div>

              {/* In-Browser Audio Player */}
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-center gap-3">
                <audio
                  controls
                  className="w-full h-10 accent-emerald-500"
                  src={`/api/files/download?file=${encodeURIComponent(dubResult.relativePath || dubResult.fileName)}`}
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onOpenFolder('dubbed_audio')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all"
                >
                  <FolderOpen className="w-4 h-4 text-amber-400" />
                  <span>Open in Explorer</span>
                </button>

                <button
                  type="button"
                  onClick={() => onDownloadFile(dubResult.relativePath || dubResult.fileName)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>Save to Browser</span>
                </button>
              </div>
            </div>
          )}

          {/* Optional Transcript / Subtitle Accordion (Enables Dubbing without API Key) */}
          <div className="rounded-xl bg-slate-900/60 border border-slate-800 overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setShowTranscriptBox(!showTranscriptBox)}
              className="w-full flex items-center justify-between p-3.5 hover:bg-slate-850/60 transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-violet-400" />
                <span className="font-semibold text-slate-200">
                  Optional Dialogue Transcript or Subtitles
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold uppercase">
                  Zero API Key Option
                </span>
              </div>
              {showTranscriptBox ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {showTranscriptBox && (
              <div className="p-3.5 pt-0 space-y-2 border-t border-slate-800/80 bg-slate-950/40 animate-fadeIn">
                <p className="text-[11px] text-slate-400">
                  If you already have the English transcript or downloaded subtitles for this clip, paste it here. StreamVault will translate and dub the speech using free translation <strong>without requiring any Gemini API key</strong>!
                </p>
                <textarea
                  rows={4}
                  value={dubTranscript}
                  onChange={(e) => setDubTranscript(e.target.value)}
                  placeholder="Paste English spoken dialogue or subtitle text here..."
                  className="w-full bg-slate-900 text-slate-100 text-xs p-3 rounded-xl border border-slate-700 outline-none focus:border-violet-500 font-sans resize-y"
                />
              </div>
            )}
          </div>

          {/* Warning Banner if No API Key and No Transcript */}
          {!geminiApiKey && !dubTranscript.trim() && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-3 animate-fadeIn">
              <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-amber-200">Free Gemini API Key Required for Speech-to-Text</p>
                <p className="text-[11px] text-amber-300/80 leading-relaxed">
                  Audio files are acoustic sound waves. To transcribe spoken dialogue from raw audio, a free Google Gemini API key is needed. Click{' '}
                  <button
                    type="button"
                    onClick={() => setShowKeyModal(true)}
                    className="underline font-bold text-white hover:text-amber-200 cursor-pointer"
                  >
                    Add Free API Key
                  </button>{' '}
                  above (free tier at aistudio.google.com, no credit card required), or paste dialogue into the <strong>Optional Dialogue Transcript</strong> box above.
                </p>
              </div>
            </div>
          )}

          {/* Action Button */}
          <div>
            <button
              type="button"
              onClick={handleStartDubbing}
              disabled={isDubbing}
              className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-gradient-to-r from-violet-600 via-indigo-600 to-violet-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-base rounded-2xl shadow-xl shadow-violet-600/25 transition-all active:scale-[0.99]"
            >
              {isDubbing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Converting & Dubbing Audio...</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-5 h-5" />
                  <span>
                    Convert Audio to {targetLang === 'gu' ? 'Gujarati' : 'Hindi'} ({dubGender.toUpperCase()})
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: TEXT-TO-SPEECH (TTS) STUDIO                        */}
      {/* ========================================================= */}
      {subTab === 'tts' && (
        <div className="space-y-5 animate-fadeIn">
          {/* Text Input Area */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                <FileText className="w-4 h-4 text-violet-400" />
                <span>Text Input</span>
              </label>

              {/* Sample prompts */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-500 text-[11px]">Load Sample:</span>
                <button
                  type="button"
                  onClick={() => { setTtsText(SAMPLE_TEXTS.en); setTtsLang('en'); }}
                  className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => { setTtsText(SAMPLE_TEXTS.hi); setTtsLang('hi'); }}
                  className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                >
                  Hindi
                </button>
                <button
                  type="button"
                  onClick={() => { setTtsText(SAMPLE_TEXTS.gu); setTtsLang('gu'); }}
                  className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                >
                  Gujarati
                </button>
              </div>
            </div>

            <div className="relative">
              <textarea
                value={ttsText}
                onChange={(e) => setTtsText(e.target.value)}
                rows={4}
                placeholder="Enter text in English, Hindi, or Gujarati to convert into studio-quality voice..."
                className="w-full bg-slate-900 text-slate-100 text-sm p-3.5 rounded-xl border border-slate-700 outline-none focus:border-violet-500 resize-y leading-relaxed"
              />
              <div className="absolute right-3 bottom-3 text-[11px] text-slate-500 font-mono">
                {ttsText.length} characters
              </div>
            </div>
          </div>

          {/* Controls: Language, Gender, and 4 Tones */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Language & Voice Gender */}
            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                  Language
                </label>
                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  {[
                    { id: 'en', label: 'English' },
                    { id: 'hi', label: 'Hindi' },
                    { id: 'gu', label: 'Gujarati' }
                  ].map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setTtsLang(l.id)}
                      className={`py-1.5 rounded-lg font-bold transition-all ${
                        ttsLang === l.id
                          ? 'bg-violet-600 text-white shadow'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1 pt-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                  Voice Gender
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setTtsGender('male')}
                    className={`py-2 px-3 rounded-xl border font-bold flex items-center justify-center gap-1.5 transition-all ${
                      ttsGender === 'male'
                        ? 'bg-violet-500/20 border-violet-500 text-white shadow'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>👨 Male Voice</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTtsGender('female')}
                    className={`py-2 px-3 rounded-xl border font-bold flex items-center justify-center gap-1.5 transition-all ${
                      ttsGender === 'female'
                        ? 'bg-violet-500/20 border-violet-500 text-white shadow'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>👩 Female Voice</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 3-4 Tones / Personas (2 Cols) */}
            <div className="md:col-span-2 p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-violet-400" />
                <span>Voice Tone & Style Persona</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {TONES_LIST.map((t) => {
                  const isSelected = ttsTone === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTtsTone(t.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'bg-violet-500/15 border-violet-500 text-white shadow-sm'
                          : 'bg-slate-800/50 border-slate-700/60 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                          <span>{t.icon}</span>
                          <span>{t.label}</span>
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-violet-400" />}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">{t.desc}</p>
                    </button>
                  );
                })}
              </div>

              {/* Sliders for Speed & Pitch */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Speed Rate:</span>
                    <span className="font-mono text-violet-400">{ttsSpeed.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.8"
                    max="1.4"
                    step="0.05"
                    value={ttsSpeed}
                    onChange={(e) => setTtsSpeed(parseFloat(e.target.value))}
                    className="w-full accent-violet-500 cursor-pointer"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Pitch Modulation:</span>
                    <span className="font-mono text-violet-400">{ttsPitch > 0 ? `+${ttsPitch}` : ttsPitch} Hz</span>
                  </div>
                  <input
                    type="range"
                    min="-10"
                    max="10"
                    step="1"
                    value={ttsPitch}
                    onChange={(e) => setTtsPitch(parseInt(e.target.value))}
                    className="w-full accent-violet-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Optional Output Name */}
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <span className="text-slate-400 whitespace-nowrap">Output Name (Optional):</span>
              <input
                type="text"
                value={customTtsName}
                onChange={(e) => setCustomTtsName(e.target.value)}
                placeholder="e.g. intro_announcement"
                className="w-full bg-slate-800 text-slate-200 px-3 py-1.5 rounded-xl border border-slate-700 outline-none focus:border-violet-500"
              />
            </div>

            <div className="text-slate-400 font-mono text-[11px]">
              Saves to: <strong className="text-violet-400">/downloads/tts_audio</strong>
            </div>
          </div>

          {/* Error alert */}
          {ttsError && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center justify-between gap-3 animate-fadeIn">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{ttsError}</span>
              </div>
              <button onClick={() => setTtsError(null)} className="text-red-400 hover:text-white">
                Dismiss
              </button>
            </div>
          )}

          {/* Generated Result Card with Audio Player */}
          {ttsResult && (
            <div className="p-5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-4 animate-fadeIn">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 text-emerald-400">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-bold text-white">Voiceover Generated Successfully!</h4>
                    <p className="text-xs text-emerald-300/90 mt-0.5">
                      Output saved to <code className="font-mono text-white">/downloads/tts_audio/{ttsResult.fileName}</code> ({ttsResult.fileSizeFormatted})
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setTtsResult(null)}
                  className="text-xs text-slate-400 hover:text-white px-2 py-1"
                >
                  Dismiss
                </button>
              </div>

              {/* In-browser preview */}
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-center gap-3">
                <audio
                  controls
                  className="w-full h-10 accent-emerald-500"
                  src={`/api/files/download?file=${encodeURIComponent(ttsResult.relativePath || ttsResult.fileName)}`}
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onOpenFolder('tts_audio')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all"
                >
                  <FolderOpen className="w-4 h-4 text-amber-400" />
                  <span>Open in Explorer</span>
                </button>

                <button
                  type="button"
                  onClick={() => onDownloadFile(ttsResult.relativePath || ttsResult.fileName)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>Save to Browser</span>
                </button>
              </div>
            </div>
          )}

          {/* Optional Transcript / Subtitle Accordion (Enables Dubbing without API Key) */}
          <div className="rounded-xl bg-slate-900/60 border border-slate-800 overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setShowTranscriptBox(!showTranscriptBox)}
              className="w-full flex items-center justify-between p-3.5 hover:bg-slate-850/60 transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-violet-400" />
                <span className="font-semibold text-slate-200">
                  Optional Dialogue Transcript or Subtitles
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold uppercase">
                  Zero API Key Option
                </span>
              </div>
              {showTranscriptBox ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {showTranscriptBox && (
              <div className="p-3.5 pt-0 space-y-2 border-t border-slate-800/80 bg-slate-950/40 animate-fadeIn">
                <p className="text-[11px] text-slate-400">
                  If you already have the English transcript or downloaded subtitles for this clip, paste it here. StreamVault will translate and dub the speech using free translation <strong>without requiring any Gemini API key</strong>!
                </p>
                <textarea
                  rows={4}
                  value={dubTranscript}
                  onChange={(e) => setDubTranscript(e.target.value)}
                  placeholder="Paste English spoken dialogue or subtitle text here..."
                  className="w-full bg-slate-900 text-slate-100 text-xs p-3 rounded-xl border border-slate-700 outline-none focus:border-violet-500 font-sans resize-y"
                />
              </div>
            )}
          </div>

          {/* Warning Banner if No API Key and No Transcript */}
          {!geminiApiKey && !dubTranscript.trim() && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-3 animate-fadeIn">
              <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-amber-200">Free Gemini API Key Required for Speech-to-Text</p>
                <p className="text-[11px] text-amber-300/80 leading-relaxed">
                  Audio files are acoustic sound waves. To transcribe spoken dialogue from raw audio, a free Google Gemini API key is needed. Click{' '}
                  <button
                    type="button"
                    onClick={() => setShowKeyModal(true)}
                    className="underline font-bold text-white hover:text-amber-200 cursor-pointer"
                  >
                    Add Free API Key
                  </button>{' '}
                  above (free tier at aistudio.google.com, no credit card required), or paste dialogue into the <strong>Optional Dialogue Transcript</strong> box above.
                </p>
              </div>
            </div>
          )}

          {/* Action Button */}
          <div>
            <button
              type="button"
              onClick={handleGenerateTTS}
              disabled={isGeneratingTts}
              className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-gradient-to-r from-violet-600 via-indigo-600 to-violet-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-base rounded-2xl shadow-xl shadow-violet-600/25 transition-all active:scale-[0.99]"
            >
              {isGeneratingTts ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Synthesizing Neural Speech...</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-5 h-5" />
                  <span>
                    Convert Text to {ttsLang.toUpperCase()} Voice ({ttsGender.toUpperCase()} • {ttsTone.toUpperCase()})
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Free API Key Configuration Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="glass-panel w-full max-w-lg rounded-2xl p-6 border border-slate-700 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 font-bold text-white text-base">
                <Key className="w-5 h-5 text-violet-400" />
                <span>Configure Free Gemini API Key</span>
              </div>
              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Google Gemini provides a <strong>100% free tier</strong> (no credit card required) that enables speech understanding and natural Indian language translation for the AI Audio Dubber.
            </p>

            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-2">
              <div className="flex items-center justify-between text-slate-300 font-semibold">
                <span>How to get a Free Key:</span>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-violet-400 hover:underline flex items-center gap-1"
                >
                  <span>Open Google AI Studio</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <ol className="list-decimal list-inside text-slate-400 space-y-1 text-[11px]">
                <li>Sign in with your Google account.</li>
                <li>Click <strong>"Create API Key"</strong>.</li>
                <li>Copy and paste your key below.</li>
              </ol>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Your Gemini API Key:</label>
              <input
                type="password"
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full bg-slate-850 text-slate-100 text-xs px-3.5 py-2.5 rounded-xl border border-slate-700 outline-none focus:border-violet-500 font-mono"
              />
              <span className="text-[10px] text-slate-500">
                Key is stored securely in your browser's local storage and used only for audio dubbing requests.
              </span>
            </div>

            {keySavedMsg && (
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                <Check className="w-4 h-4" />
                <span>API Key saved successfully!</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-400 hover:text-white"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSaveApiKey}
                className="px-4 py-2 text-xs font-bold bg-violet-600 hover:bg-violet-500 text-white rounded-xl shadow transition-all"
              >
                Save Key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
