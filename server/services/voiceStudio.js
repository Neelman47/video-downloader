import fs from 'fs';
import path from 'path';
import { spawn, execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { EdgeTTS } from '@andresaya/edge-tts';
import { getDownloadsDir, formatBytes, getTimestampPrefix, SUBFOLDERS } from './storage.js';
import { getFfmpegPath, sanitizeFileName } from './downloader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

const activeDubbingJobs = new Map();

// Supported Voice Roster
export const VOICE_ROSTER = {
  en: {
    name: 'English (US)',
    male: { id: 'en-US-GuyNeural', name: 'Guy (Natural Male)' },
    female: { id: 'en-US-JennyNeural', name: 'Jenny (Natural Female)' }
  },
  hi: {
    name: 'Hindi (India)',
    male: { id: 'hi-IN-MadhurNeural', name: 'Madhur (मधुर - Natural Male)' },
    female: { id: 'hi-IN-SwaraNeural', name: 'Swara (स्वरा - Natural Female)' }
  },
  gu: {
    name: 'Gujarati (India)',
    male: { id: 'gu-IN-NiranjanNeural', name: 'Niranjan (નિરંજન - Natural Male)' },
    female: { id: 'gu-IN-DhwaniNeural', name: 'Dhwani (ધ્વનિ - Natural Female)' }
  }
};

// Preset Tone Configurations
export const VOICE_TONES = {
  conversational: {
    id: 'conversational',
    label: 'Conversational / Friendly',
    desc: 'Warm everyday speech for podcasts, vlogs, and casual dialogue',
    rate: '+0%',
    pitch: '+0Hz'
  },
  professional: {
    id: 'professional',
    label: 'Professional / Formal / News',
    desc: 'Clear, steady, authoritative cadence for presentations & tutorials',
    rate: '-4%',
    pitch: '-2Hz'
  },
  energetic: {
    id: 'energetic',
    label: 'Energetic / Storyteller',
    desc: 'Dynamic, upbeat pacing for entertainment & promos',
    rate: '+14%',
    pitch: '+4Hz'
  },
  calm: {
    id: 'calm',
    label: 'Calm / Relaxed / Audiobook',
    desc: 'Soothing, gentle delivery for meditation & audiobooks',
    rate: '-10%',
    pitch: '-3Hz'
  }
};

/**
 * Check if Demucs and Python are available on host system
 */
export function checkVoiceSystemStatus() {
  let pythonAvailable = false;
  let demucsAvailable = false;

  try {
    const pyCheck = execSync('where.exe python || which python || py --version', { stdio: 'pipe' }).toString();
    if (pyCheck) pythonAvailable = true;
  } catch (e) {}

  try {
    const demucsCheck = execSync('where.exe demucs || which demucs || python -m demucs --help', { stdio: 'pipe' }).toString();
    if (demucsCheck) demucsAvailable = true;
  } catch (e) {}

  return {
    pythonAvailable,
    demucsAvailable,
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    supportedVoices: VOICE_ROSTER,
    tones: VOICE_TONES
  };
}

/**
 * Robust Edge TTS synthesizer with automatic retries and exponential backoff
 */
export async function synthesizeSpeechWithRetry(text, voiceId, options = {}, maxRetries = 3) {
  let lastErr = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const tts = new EdgeTTS();
      await tts.synthesize(text, voiceId, options);
      return tts;
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 600 * attempt));
      }
    }
  }
  throw lastErr || new Error('TTS synthesis failed after multiple attempts');
}

/**
 * Free translation fallback using Google Translate gtx endpoint
 */
export async function translateTextFree(text, targetLang = 'hi') {
  if (!text || !text.trim()) return '';
  const langCode = targetLang === 'gu' ? 'gu' : 'hi';
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${langCode}&dt=t&q=${encodeURIComponent(text)}`;
  
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  if (!res.ok) {
    throw new Error(`Translation request failed with HTTP ${res.status}`);
  }
  const data = await res.json();
  if (Array.isArray(data) && Array.isArray(data[0])) {
    return data[0].map((item) => item[0]).join('');
  }
  return text;
}

/**
 * Clean and extract dialogue text from an SRT subtitle string
 */
export function extractTextFromSrt(srtContent) {
  if (!srtContent) return '';
  const lines = srtContent.split(/\r?\n/);
  const clean = [];
  let last = '';

  for (const raw of lines) {
    const t = raw.trim();
    if (!t || /^\d+$/.test(t) || /^\d{2}:\d{2}:\d{2}/.test(t)) continue;
    const c = t
      .replace(/&gt;&gt;/g, '')
      .replace(/>>/g, '')
      .replace(/\[.*?\]/g, '')
      .replace(/<.*?>/g, '')
      .trim();
    if (c && c !== last) {
      clean.push(c);
      last = c;
    }
  }

  return clean.join(' ');
}

/**
 * Attempt to find a matching English subtitle file in downloads/subtitles/
 */
export function findMatchingSubtitleFile(audioPath) {
  try {
    const subDir = getDownloadsDir(SUBFOLDERS.SUBTITLES);
    if (!fs.existsSync(subDir)) return null;

    const baseName = path.basename(audioPath).replace(/\.[^/.]+$/, '').toLowerCase();
    const files = fs.readdirSync(subDir);

    // Look for video ID in brackets e.g. [OGO4Mqvo3jI]
    const idMatch = baseName.match(/\[([a-zA-Z0-9_-]{11})\]/);
    const videoId = idMatch ? idMatch[1] : null;

    for (const f of files) {
      if (!f.endsWith('.srt') && !f.endsWith('.vtt')) continue;
      const fLower = f.toLowerCase();

      // Check by video ID if available
      if (videoId && fLower.includes(videoId)) {
        return path.join(subDir, f);
      }

      // Check by normalized title match
      const strippedBase = baseName.replace(/^[0-9_]+/, '').replace(/\[.*?\]/g, '').trim().slice(0, 20);
      if (strippedBase && fLower.includes(strippedBase)) {
        return path.join(subDir, f);
      }
    }
  } catch (e) {}
  return null;
}

/**
 * Feature 2: Generate Text to Audio (TTS Studio)
 */
export async function generateTTS(options) {
  const {
    text,
    language = 'en',
    gender = 'male',
    tone = 'conversational',
    speed = 1.0,
    pitch = 0,
    outputName = ''
  } = options;

  if (!text || !text.trim()) {
    throw new Error('Please enter some text to convert to speech');
  }

  const langKey = VOICE_ROSTER[language] ? language : 'en';
  const genderKey = gender === 'female' ? 'female' : 'male';
  const selectedVoice = VOICE_ROSTER[langKey][genderKey].id;

  // Compute tone pitch and rate adjustments
  const toneObj = VOICE_TONES[tone] || VOICE_TONES.conversational;
  let baseRate = parseInt(toneObj.rate.replace('%', '')) || 0;
  let basePitch = parseInt(toneObj.pitch.replace('Hz', '')) || 0;

  // Add user custom speed & pitch offsets
  const speedPercent = Math.round((speed - 1.0) * 100);
  const totalRate = Math.max(-50, Math.min(100, baseRate + speedPercent));
  const totalPitch = Math.max(-30, Math.min(30, basePitch + parseInt(pitch || 0)));

  const ttsOptions = {
    rate: `${totalRate >= 0 ? '+' : ''}${totalRate}%`,
    pitch: `${totalPitch >= 0 ? '+' : ''}${totalPitch}Hz`
  };

  const ttsInstance = await synthesizeSpeechWithRetry(text.trim(), selectedVoice, ttsOptions);

  const timestampPrefix = getTimestampPrefix();
  const safeTitle = outputName
    ? sanitizeFileName(outputName).replace(/\.[^/.]+$/, '')
    : sanitizeFileName(text.slice(0, 30));
  
  const targetFileName = `${timestampPrefix}tts_${safeTitle || 'speech'}_${language}_${genderKey}.mp3`;
  const targetDir = getDownloadsDir(SUBFOLDERS.TTS);
  const targetFilePath = path.join(targetDir, targetFileName);

  await ttsInstance.toFile(targetFilePath);

  const stats = fs.statSync(targetFilePath);

  return {
    fileName: targetFileName,
    relativePath: `${SUBFOLDERS.TTS}/${targetFileName}`,
    filePath: targetFilePath,
    fileSize: stats.size,
    fileSizeFormatted: formatBytes(stats.size),
    language,
    gender: genderKey,
    tone,
    voice: selectedVoice
  };
}

/**
 * Resolve audio file path from downloads directory or absolute path
 */
export function resolveAudioInput(givenPath) {
  if (!givenPath) return null;
  const downloadsDir = getDownloadsDir();

  if (path.isAbsolute(givenPath) && fs.existsSync(givenPath)) {
    return givenPath;
  }

  const direct = path.join(downloadsDir, givenPath);
  if (fs.existsSync(direct)) return direct;

  for (const folder of Object.values(SUBFOLDERS)) {
    const candidate = path.join(downloadsDir, folder, path.basename(givenPath));
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}

/**
 * Feature 1: AI Audio Dubbing Pipeline (English -> Hindi or Gujarati)
 */
export async function executeDubbing(jobId, options, callbacks) {
  const {
    inputAudioPath,
    targetLanguage = 'hi', // 'hi' | 'gu'
    voiceGender = 'auto',  // 'auto' | 'male' | 'female'
    separationMode = 'auto', // 'auto' | 'demucs' | 'pure_voice' | 'ffmpeg_filter'
    apiKey,
    transcriptText = '',
    outputName = ''
  } = options;
  let currentGender = voiceGender;
  const { onProgress, onComplete, onError } = callbacks;

  const resolvedInput = resolveAudioInput(inputAudioPath);
  if (!resolvedInput) {
    return onError(new Error(`Input audio file not found: ${inputAudioPath}`));
  }

  const abortController = {
    aborted: false,
    processes: [],
    tempFiles: []
  };
  activeDubbingJobs.set(jobId, abortController);

  const tempDir = getDownloadsDir();
  const rawBaseName = path.basename(resolvedInput, path.extname(resolvedInput));
  const timestampPrefix = getTimestampPrefix();
  const safeOutput = outputName ? sanitizeFileName(outputName) : `dubbed_${targetLanguage}_${rawBaseName}`;
  const targetFileName = `${timestampPrefix}${safeOutput}.mp3`;
  const targetDir = getDownloadsDir(SUBFOLDERS.DUBBED);
  const targetFilePath = path.join(targetDir, targetFileName);

  const tempVocalsPath = path.join(tempDir, `temp_${jobId}_vocals.wav`);
  const tempBgPath = path.join(tempDir, `temp_${jobId}_background.wav`);
  const tempDubbedVoicePath = path.join(tempDir, `temp_${jobId}_translated_voice.mp3`);
  abortController.tempFiles.push(tempVocalsPath, tempBgPath, tempDubbedVoicePath);

  try {
    // -------------------------------------------------------------
    // STAGE 1: Vocal and Background Stem Separation
    // -------------------------------------------------------------
    onProgress({
      percent: '15%',
      status: 'processing',
      message: 'Stage 1/5: Isolating English vocals and background music...'
    });

    const sysStatus = checkVoiceSystemStatus();
    let hasBackgroundTrack = false;

    if (separationMode === 'pure_voice') {
      // User says input is clean voiceover without background music
      hasBackgroundTrack = false;
    } else if (sysStatus.demucsAvailable && separationMode !== 'ffmpeg_filter') {
      // Run Python Demucs
      onProgress({
        percent: '25%',
        status: 'processing',
        message: 'Stage 1/5: Running Python Demucs neural stem separation...'
      });

      await new Promise((resolve, reject) => {
        const demucsProc = spawn('demucs', [
          '--two-stems=vocals',
          '-o', tempDir,
          resolvedInput
        ], { windowsHide: true });
        abortController.processes.push(demucsProc);

        demucsProc.on('close', (code) => {
          if (code === 0) {
            // Demucs outputs to <tempDir>/htdemucs/<track>/vocals.wav and no_vocals.wav
            const demucsOutDir = path.join(tempDir, 'htdemucs', rawBaseName);
            const demucsVocals = path.join(demucsOutDir, 'vocals.wav');
            const demucsBg = path.join(demucsOutDir, 'no_vocals.wav');

            if (fs.existsSync(demucsBg)) {
              try { fs.copyFileSync(demucsBg, tempBgPath); } catch (e) {}
              hasBackgroundTrack = true;
            }
            if (fs.existsSync(demucsVocals)) {
              try { fs.copyFileSync(demucsVocals, tempVocalsPath); } catch (e) {}
            }
            resolve();
          } else {
            resolve(); // Gracefully fallback to FFmpeg
          }
        });
        demucsProc.on('error', () => resolve());
      });
    }

    // If Demucs didn't run or wasn't available, use FFmpeg vocal attenuation filter
    if (!hasBackgroundTrack && separationMode !== 'pure_voice') {
      await new Promise((resolve) => {
        const ffmpegPath = getFfmpegPath();
        // Phase inversion + low shelf vocal cut for background track
        const ffmpegProc = spawn(ffmpegPath, [
          '-i', resolvedInput,
          '-af', 'pan=stereo|c0=c0-0.5*c1|c1=c1-0.5*c0,equalizer=f=1000:t=q:w=1:g=-8',
          '-y', tempBgPath
        ], { windowsHide: true });
        abortController.processes.push(ffmpegProc);

        ffmpegProc.on('close', (code) => {
          if (code === 0 && fs.existsSync(tempBgPath)) {
            hasBackgroundTrack = true;
          }
          resolve();
        });
        ffmpegProc.on('error', () => resolve());
      });
    }

    if (abortController.aborted) return;

    // -------------------------------------------------------------
    // STAGE 2: Speech Recognition & Translation (EN -> HI / GU)
    // -------------------------------------------------------------
    onProgress({
      percent: '40%',
      status: 'processing',
      message: `Stage 2/5: Transcribing and translating English speech to ${targetLanguage === 'gu' ? 'Gujarati' : 'Hindi'}...`
    });

    let translatedSegments = [];

    // Check if free Gemini API key is provided
    const effectiveApiKey = apiKey || process.env.GEMINI_API_KEY;

    if (effectiveApiKey && fs.existsSync(resolvedInput)) {
      try {
        // Pre-convert audio to lightweight 16kHz mono 64kbps MP3 (ideal for speech AI, ~480KB/min)
        const tempGeminiAudio = path.join(tempDir, `temp_${jobId}_gemini_audio.mp3`);
        abortController.tempFiles.push(tempGeminiAudio);

        const sourceForGemini = (hasBackgroundTrack && fs.existsSync(tempVocalsPath)) ? tempVocalsPath : resolvedInput;
        const ffmpegPath = getFfmpegPath();

        await new Promise((resolve) => {
          const proc = spawn(ffmpegPath, [
            '-i', sourceForGemini,
            '-vn',
            '-ac', '1',
            '-ar', '16000',
            '-b:a', '64k',
            '-y', tempGeminiAudio
          ], { windowsHide: true });
          abortController.processes.push(proc);
          proc.on('close', () => resolve());
          proc.on('error', () => resolve());
        });

        if (fs.existsSync(tempGeminiAudio)) {
          const audioBuffer = fs.readFileSync(tempGeminiAudio);
          const base64Audio = audioBuffer.toString('base64');

          const promptText = `
You are an expert voice dubbing translator and dialogue synchronizer.
Listen carefully to the English audio and:
1. Transcribe the entire spoken English dialogue from start to finish.
2. Translate the speech into natural, colloquial ${targetLanguage === 'gu' ? 'Gujarati (in Gujarati script)' : 'Hindi (in Devanagari script)'}. Ensure the translation flows naturally and captures the mood of the dialogue.
3. Detect whether the primary speaker is Male or Female.
Respond strictly in valid JSON format:
{
  "detectedGender": "male" or "female",
  "text": "full translated speech in target script",
  "segments": [
    { "start": 0.0, "end": 4.5, "translated": "..." }
  ]
}
`;

          // Query ModelService.ListModels on v1beta and v1 to find exact models supported by this API key
          let candidateEndpoints = [];

          for (const ver of ['v1beta', 'v1']) {
            try {
              const listRes = await fetch(`https://generativelanguage.googleapis.com/${ver}/models?key=${effectiveApiKey}`);
              const listData = await listRes.json();
              if (listData.models && Array.isArray(listData.models)) {
                const supported = listData.models.filter((m) => {
                  if (!Array.isArray(m.supportedGenerationMethods) || !m.supportedGenerationMethods.includes('generateContent')) {
                    return false;
                  }
                  const name = m.name.toLowerCase();
                  if (name.includes('image') || name.includes('tts') || name.includes('embed') || name.includes('veo') || name.includes('imagen')) {
                    return false;
                  }
                  return true;
                });

                // Prioritize proven audio-capable flash endpoints (flash-lite-latest, 3-flash, 3.1-flash, 2.0-flash)
                supported.sort((a, b) => {
                  const score = (item) => {
                    const n = item.name.toLowerCase();
                    if (n.includes('flash-lite-latest')) return 10;
                    if (n.includes('3-flash')) return 9;
                    if (n.includes('3.1-flash-lite')) return 8;
                    if (n.includes('3.5-flash-lite')) return 7;
                    if (n.includes('2.0-flash')) return 6;
                    if (n.includes('1.5-flash')) return 5;
                    if (n.includes('flash')) return 4;
                    return 1;
                  };
                  return score(b) - score(a);
                });

                for (const m of supported) {
                  const mName = m.name.replace(/^models\//, '');
                  candidateEndpoints.push({
                    url: `https://generativelanguage.googleapis.com/${ver}/models/${mName}:generateContent?key=${effectiveApiKey}`,
                    name: `${mName} (${ver})`
                  });
                }
              }
            } catch (listErr) {
              // Continue
            }
          }

          // If ListModels did not return entries, try candidate models directly
          if (candidateEndpoints.length === 0) {
            candidateEndpoints = [
              { url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${effectiveApiKey}`, name: 'gemini-flash-lite-latest (v1beta)' },
              { url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${effectiveApiKey}`, name: 'gemini-2.0-flash (v1beta)' },
              { url: `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${effectiveApiKey}`, name: 'gemini-2.0-flash (v1)' },
              { url: `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${effectiveApiKey}`, name: 'gemini-1.5-flash (v1)' }
            ];
          }

          for (const endpoint of candidateEndpoints) {
            try {
              console.log(`[Gemini] Attempting speech recognition with ${endpoint.name}...`);
              const geminiRes = await fetch(endpoint.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{
                    parts: [
                      { text: promptText },
                      { inline_data: { mime_type: 'audio/mp3', data: base64Audio } }
                    ]
                  }],
                  generationConfig: { response_mime_type: 'application/json' }
                })
              });

              const geminiData = await geminiRes.json();
              if (geminiData.error) {
                console.warn(`[Gemini] ${endpoint.name} returned error:`, geminiData.error.message);
                continue; // Try next candidate
              }

              const rawJsonText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
              if (rawJsonText) {
                let parsed;
                try {
                  parsed = JSON.parse(rawJsonText);
                } catch (pe) {
                  const match = rawJsonText.match(/\{[\s\S]*\}/);
                  if (match) parsed = JSON.parse(match[0]);
                  else parsed = { text: rawJsonText };
                }

                if (parsed.text && parsed.text.trim()) {
                  console.log(`[Gemini] Speech recognition successful with ${endpoint.name}! Output chars: ${parsed.text.length}`);
                  translatedSegments.push({ translated: parsed.text.trim() });
                }
                if (parsed.detectedGender && currentGender === 'auto') {
                  currentGender = parsed.detectedGender.toLowerCase();
                }
                if (translatedSegments.length > 0) {
                  onProgress({
                    percent: '55%',
                    status: 'processing',
                    message: `Stage 2/5: Speech recognized and translated successfully (${parsed.text.length} chars)!`
                  });
                  break; // Finished successfully!
                }
              }
            } catch (callErr) {
              console.warn(`[Gemini] Call to ${endpoint.name} failed:`, callErr.message);
            }
          }
        }
      } catch (geminiErr) {
        console.warn('Gemini audio translation fallback triggered:', geminiErr.message);
      }
    }

    // Fallback 1: If transcript text was explicitly provided in options
    if (translatedSegments.length === 0 && transcriptText && transcriptText.trim()) {
      onProgress({
        percent: '50%',
        status: 'processing',
        message: `Stage 2/5: Translating provided dialogue transcript to ${targetLanguage === 'gu' ? 'Gujarati' : 'Hindi'}...`
      });
      const translated = await translateTextFree(transcriptText.trim(), targetLanguage);
      translatedSegments.push({ translated });
    }

    // Fallback 2: Auto-detect matching English subtitles from downloads/subtitles/
    if (translatedSegments.length === 0) {
      const matchingSub = findMatchingSubtitleFile(resolvedInput);
      if (matchingSub && fs.existsSync(matchingSub)) {
        try {
          const srtRaw = fs.readFileSync(matchingSub, 'utf8');
          const cleanDialogue = extractTextFromSrt(srtRaw);
          if (cleanDialogue && cleanDialogue.length > 10) {
            onProgress({
              percent: '50%',
              status: 'processing',
              message: `Stage 2/5: Found matching subtitle (${path.basename(matchingSub)}), translating dialogue...`
            });
            console.log(`[Dubber] Using auto-detected subtitle ${path.basename(matchingSub)} (${cleanDialogue.length} chars)`);
            const translated = await translateTextFree(cleanDialogue, targetLanguage);
            translatedSegments.push({ translated });
          }
        } catch (subErr) {
          console.warn('[Dubber] Subtitle auto-detect read error:', subErr.message);
        }
      }
    }

    // If still no translated segments, do NOT synthesize a fake 9-second placeholder!
    if (translatedSegments.length === 0) {
      const errorMsg = effectiveApiKey
        ? 'Gemini audio speech recognition could not find a supported model or detect dialogue. You can paste the dialogue or subtitle text in the "Optional Dialogue Transcript" section to dub without API limits.'
        : 'A free Gemini API key is required to listen to and transcribe raw audio files. Please click "Add Free API Key" at the top of the Dubbing & TTS page, or provide the dialogue transcript/subtitles.';
      return onError(new Error(errorMsg));
    }

    if (abortController.aborted) return;

    // -------------------------------------------------------------
    // STAGE 3: Neural Voice Synthesis in Target Language
    // -------------------------------------------------------------
    const chosenGender = (currentGender === 'female') ? 'female' : 'male';
    const langKey = targetLanguage === 'gu' ? 'gu' : 'hi';
    const voiceId = VOICE_ROSTER[langKey][chosenGender].id;

    onProgress({
      percent: '65%',
      status: 'processing',
      message: `Stage 3/5: Synthesizing ${chosenGender} ${targetLanguage === 'gu' ? 'Gujarati' : 'Hindi'} voice (${VOICE_ROSTER[langKey][chosenGender].name})...`
    });

    const fullTranslatedText = translatedSegments.map((s) => s.translated).join(' ');
    const ttsInstance = await synthesizeSpeechWithRetry(fullTranslatedText, voiceId, { rate: '+0%', pitch: '+0Hz' });
    await ttsInstance.toFile(tempDubbedVoicePath);

    if (abortController.aborted) return;

    // -------------------------------------------------------------
    // STAGE 4 & 5: Audio Mixing with Background Music (Smart Ducking)
    // -------------------------------------------------------------
    onProgress({
      percent: '85%',
      status: 'processing',
      message: hasBackgroundTrack
        ? 'Stage 4/5: Mixing translated voice with background music & audio ducking...'
        : 'Stage 4/5: Finalizing translated audio encoding...'
    });

    const ffmpegPath = getFfmpegPath();
    const ffmpegArgs = [];

    if (hasBackgroundTrack && fs.existsSync(tempBgPath)) {
      // Audio ducking: lower background music volume to 30% and mix with new translated voice
      ffmpegArgs.push(
        '-i', tempDubbedVoicePath,
        '-i', tempBgPath,
        '-filter_complex', '[1:a]volume=0.30[bg];[0:a][bg]amix=inputs=2:duration=first:dropout_transition=2[out]',
        '-map', '[out]',
        '-c:a', 'libmp3lame',
        '-b:a', '192k',
        '-y',
        targetFilePath
      );
    } else {
      // Pure speech output
      ffmpegArgs.push(
        '-i', tempDubbedVoicePath,
        '-c:a', 'libmp3lame',
        '-b:a', '192k',
        '-y',
        targetFilePath
      );
    }

    const ffmpegProc = spawn(ffmpegPath, ffmpegArgs, { windowsHide: true });
    abortController.processes.push(ffmpegProc);

    ffmpegProc.on('close', (code) => {
      // Clean up temporary files
      for (const f of abortController.tempFiles) {
        try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (e) {}
      }
      activeDubbingJobs.delete(jobId);

      if (code === 0 && fs.existsSync(targetFilePath)) {
        const stats = fs.statSync(targetFilePath);
        onComplete({
          jobId,
          fileName: targetFileName,
          relativePath: `${SUBFOLDERS.DUBBED}/${targetFileName}`,
          filePath: targetFilePath,
          fileSize: stats.size,
          fileSizeFormatted: formatBytes(stats.size),
          targetLanguage,
          voiceGender: chosenGender,
          voiceId,
          hasBackgroundTrack,
          translatedSnippet: fullTranslatedText.slice(0, 80) + '...',
          status: 'completed'
        });
      } else {
        onError(new Error(`Audio mixing failed with exit code ${code}`));
      }
    });

    ffmpegProc.on('error', (err) => {
      for (const f of abortController.tempFiles) {
        try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (e) {}
      }
      activeDubbingJobs.delete(jobId);
      onError(err);
    });

  } catch (err) {
    for (const f of abortController.tempFiles) {
      try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (e) {}
    }
    activeDubbingJobs.delete(jobId);
    onError(err);
  }
}

/**
 * Cancel active dubbing job
 */
export function cancelDubbingJob(jobId) {
  const job = activeDubbingJobs.get(jobId);
  if (job) {
    job.aborted = true;
    for (const p of job.processes) {
      try { p.kill(); } catch (e) {}
    }
    for (const f of job.tempFiles) {
      try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (e) {}
    }
    activeDubbingJobs.delete(jobId);
    return { success: true };
  }
  return { success: false, error: 'Job not found' };
}
