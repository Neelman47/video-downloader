import fs from 'fs';
import path from 'path';
import { spawn, spawnSync, execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { EdgeTTS } from '@andresaya/edge-tts';
import { getDownloadsDir, formatBytes, getTimestampPrefix, SUBFOLDERS } from './storage.js';
import { getFfmpegPath, sanitizeFileName } from './downloader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
 * Parse an SRT / VTT subtitle string into timestamped dialogue cues.
 * Strips music annotations [music], lyrics ♪ ... ♪, sound effects, and speaker labels.
 * Merges contiguous speech (< 0.7s) to produce naturally paced sentences.
 */
export function parseSubtitlesToTimedCues(srtContent) {
  if (!srtContent) return [];
  const blocks = srtContent.trim().split(/\r?\n\r?\n/);
  const rawCues = [];

  for (const block of blocks) {
    const lines = block.split(/\r?\n/);
    if (lines.length < 2) continue;
    const timeLineIndex = lines[0].includes('-->') ? 0 : (lines[1] && lines[1].includes('-->') ? 1 : -1);
    if (timeLineIndex === -1) continue;
    const timeLine = lines[timeLineIndex];
    const match = timeLine.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
    if (!match) continue;
    const startSec = parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]) + parseInt(match[4]) / 1000;
    const endSec = parseInt(match[5]) * 3600 + parseInt(match[6]) * 60 + parseInt(match[7]) + parseInt(match[8]) / 1000;
    
    // Ignore micro cues < 80ms
    if (endSec - startSec < 0.08) continue;

    let textLines = lines.slice(timeLineIndex + 1).join(' ');
    
    // Filter out music symbols and lyrics
    if (/^[\s♪♫\-\[\]\(\)]*$/.test(textLines)) continue;
    if (textLines.includes('♪') || textLines.includes('♫')) {
      textLines = textLines.replace(/♪[^♪]*♪/g, '').replace(/♫[^♫]*♫/g, '').replace(/[♪♫]/g, '');
    }
    // Remove bracketed effects like [suspenseful music], [laughter], [screaming], etc.
    textLines = textLines.replace(/\[.*?\]/g, '').replace(/\(.*?\)/g, '');
    // Remove speaker names like SINGER:, CAITLYN:, MATT:, etc.
    textLines = textLines.replace(/^[A-Z0-9\s_-]+:\s*/, '').replace(/- /g, '');
    textLines = textLines.replace(/&gt;&gt;/g, '').replace(/>>/g, '').replace(/<.*?>/g, '').trim();

    if (!textLines || textLines.length < 2 || !/[a-zA-Z0-9]/.test(textLines)) continue;

    rawCues.push({ startSec, endSec, text: textLines });
  }

  // Merge contiguous cues separated by small pause (< 0.7s) for natural cadence
  const merged = [];
  for (const cue of rawCues) {
    if (merged.length === 0) {
      merged.push({ ...cue });
      continue;
    }
    const prev = merged[merged.length - 1];
    if (cue.startSec - prev.endSec < 0.7) {
      prev.text = prev.text + ' ' + cue.text;
      prev.endSec = Math.max(prev.endSec, cue.endSec);
    } else {
      merged.push({ ...cue });
    }
  }

  return merged;
}

/**
 * Clean and extract dialogue text from an SRT subtitle string (backward compatibility)
 */
export function extractTextFromSrt(srtContent) {
  const cues = parseSubtitlesToTimedCues(srtContent);
  return cues.map((c) => c.text).join(' ');
}

/**
 * Detect the start timestamp (in seconds) of the first spoken line from subtitle content
 */
export function detectFirstSubtitleTimestamp(srtContent) {
  const cues = parseSubtitlesToTimedCues(srtContent);
  if (cues.length > 0) {
    return Math.max(0, cues[0].startSec - 0.2);
  }
  return 0;
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

    // Look for YouTube video ID in brackets e.g. [OGO4Mqvo3jI]
    const idMatch = baseName.match(/\[([a-zA-Z0-9_-]{11})\]/);
    const videoId = idMatch ? idMatch[1].toLowerCase() : null;

    const candidates = [];

    for (const f of files) {
      if (!f.endsWith('.srt') && !f.endsWith('.vtt')) continue;
      const fLower = f.toLowerCase();

      // Check by video ID if available
      if (videoId && fLower.includes(videoId)) {
        candidates.push(path.join(subDir, f));
      }

      // Check by normalized title match
      const strippedBase = baseName.replace(/^[0-9_]+/, '').replace(/\[.*?\]/g, '').trim().slice(0, 20);
      if (strippedBase && fLower.includes(strippedBase)) {
        candidates.push(path.join(subDir, f));
      }
    }

    if (candidates.length > 0) {
      // Prioritize official closed captions (e.g. en-US.srt or en.srt)
      const official = candidates.find((c) => c.toLowerCase().includes('en-us') || c.toLowerCase().includes('_en.'));
      return official || candidates[0];
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
 * Synchronizes dialogue timing with subtitles / AI timestamps.
 * Preserves 100% of background music, fight sounds, action effects, and intro/outro.
 */
export async function executeDubbing(jobId, options, callbacks) {
  const {
    inputAudioPath,
    targetLanguage = 'hi', // 'hi' | 'gu'
    voiceGender = 'auto',  // 'auto' | 'male' | 'female'
    separationMode = 'auto', // 'auto' | 'demucs' | 'pure_voice'
    apiKey,
    transcriptText = '',
    outputName = '',
    bgVolume = 1.0,
    startOffset
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
  if (!fs.existsSync(targetDir)) {
    try { fs.mkdirSync(targetDir, { recursive: true }); } catch (e) {}
  }
  const targetFilePath = path.join(targetDir, targetFileName);

  const ffmpegPath = getFfmpegPath();

  try {
    // -------------------------------------------------------------
    // STAGE 1: Audio Analysis & Subtitle / Timestamp Discovery
    // -------------------------------------------------------------
    onProgress({
      percent: '10%',
      status: 'processing',
      message: 'Stage 1/5: Measuring audio duration and analyzing scene structure...'
    });

    // Probe total duration of original audio
    const probeRes = spawnSync(ffmpegPath, ['-i', resolvedInput], { encoding: 'utf8' });
    const durMatch = (probeRes.stderr || '').match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
    const totalDurationSec = durMatch
      ? parseInt(durMatch[1]) * 3600 + parseInt(durMatch[2]) * 60 + parseInt(durMatch[3]) + parseInt(durMatch[4]) / 100
      : 0;

    let dialogueCues = [];

    // Check if user provided transcript containing subtitle timestamps (SRT/VTT)
    if (transcriptText && transcriptText.includes('-->')) {
      dialogueCues = parseSubtitlesToTimedCues(transcriptText);
      if (dialogueCues.length > 0) {
        console.log(`[Dubber] Using ${dialogueCues.length} dialogue cues from user-provided transcript`);
      }
    }

    // Auto-detect matching English subtitle file from downloads/subtitles/
    if (dialogueCues.length === 0) {
      const matchingSub = findMatchingSubtitleFile(resolvedInput);
      if (matchingSub && fs.existsSync(matchingSub)) {
        try {
          const srtRaw = fs.readFileSync(matchingSub, 'utf8');
          dialogueCues = parseSubtitlesToTimedCues(srtRaw);
          if (dialogueCues.length > 0) {
            console.log(`[Dubber] Using ${dialogueCues.length} dialogue cues from matching subtitle (${path.basename(matchingSub)})`);
          }
        } catch (e) {
          console.warn('[Dubber] Error parsing matching subtitle:', e.message);
        }
      }
    }

    if (abortController.aborted) return;

    // Optional Demucs stem separation if installed
    const sysStatus = checkVoiceSystemStatus();
    let demucsBgPath = null;

    if (separationMode !== 'pure_voice' && sysStatus.demucsAvailable) {
      onProgress({
        percent: '20%',
        status: 'processing',
        message: 'Stage 1/5: Running Python Demucs stem separation for studio background isolation...'
      });

      const tempBgPath = path.join(tempDir, `temp_${jobId}_demucs_bg.wav`);
      abortController.tempFiles.push(tempBgPath);

      await new Promise((resolve) => {
        const demucsProc = spawn('demucs', [
          '--two-stems=vocals',
          '-o', tempDir,
          resolvedInput
        ], { windowsHide: true });
        abortController.processes.push(demucsProc);

        demucsProc.on('close', (code) => {
          if (code === 0) {
            const demucsOutDir = path.join(tempDir, 'htdemucs', rawBaseName);
            const demucsBg = path.join(demucsOutDir, 'no_vocals.wav');
            if (fs.existsSync(demucsBg)) {
              demucsBgPath = tempBgPath;
              try { fs.copyFileSync(demucsBg, tempBgPath); } catch (e) {}
            }
          }
          resolve();
        });
        demucsProc.on('error', () => resolve());
      });
    }

    if (abortController.aborted) return;

    // -------------------------------------------------------------
    // STAGE 2: Speech Recognition & Timestamp Alignment (Gemini AI Fallback)
    // -------------------------------------------------------------
    const effectiveApiKey = apiKey || process.env.GEMINI_API_KEY;

    if (dialogueCues.length === 0 && effectiveApiKey && fs.existsSync(resolvedInput)) {
      onProgress({
        percent: '35%',
        status: 'processing',
        message: 'Stage 2/5: Gemini AI listening to audio to detect speech timestamps...'
      });

      try {
        const tempGeminiAudio = path.join(tempDir, `temp_${jobId}_gemini_audio.mp3`);
        abortController.tempFiles.push(tempGeminiAudio);

        await new Promise((resolve) => {
          const proc = spawn(ffmpegPath, [
            '-i', resolvedInput,
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
You are an expert dialogue synchronizer and dubbing director.
Listen carefully to the audio and extract each spoken dialogue line with its exact start and end timestamps.
Translate each line into natural colloquial ${targetLanguage === 'gu' ? 'Gujarati (in Gujarati script)' : 'Hindi (in Devanagari script)'}.
Also detect if the primary speaker is male or female.
Respond strictly in valid JSON format:
{
  "detectedGender": "male" or "female",
  "segments": [
    { "start": 20.2, "end": 24.5, "text": "English line", "translated": "Translated line" }
  ]
}
`;

          let candidateEndpoints = [];
          for (const ver of ['v1beta', 'v1']) {
            try {
              const listRes = await fetch(`https://generativelanguage.googleapis.com/${ver}/models?key=${effectiveApiKey}`);
              const listData = await listRes.json();
              if (listData.models && Array.isArray(listData.models)) {
                const supported = listData.models.filter((m) => {
                  if (!Array.isArray(m.supportedGenerationMethods) || !m.supportedGenerationMethods.includes('generateContent')) return false;
                  const name = m.name.toLowerCase();
                  if (name.includes('image') || name.includes('tts') || name.includes('embed') || name.includes('veo') || name.includes('imagen')) return false;
                  return true;
                });
                supported.sort((a, b) => {
                  const score = (item) => {
                    const n = item.name.toLowerCase();
                    if (n.includes('flash-lite-latest')) return 10;
                    if (n.includes('3-flash')) return 9;
                    if (n.includes('3.1-flash-lite')) return 8;
                    if (n.includes('2.0-flash')) return 6;
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
            } catch (e) {}
          }

          if (candidateEndpoints.length === 0) {
            candidateEndpoints = [
              { url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${effectiveApiKey}`, name: 'gemini-flash-lite-latest (v1beta)' },
              { url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${effectiveApiKey}`, name: 'gemini-2.0-flash (v1beta)' }
            ];
          }

          for (const endpoint of candidateEndpoints) {
            try {
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
              if (geminiData.error) continue;

              const rawJsonText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
              if (rawJsonText) {
                let parsed;
                try {
                  parsed = JSON.parse(rawJsonText);
                } catch (pe) {
                  const match = rawJsonText.match(/\{[\s\S]*\}/);
                  if (match) parsed = JSON.parse(match[0]);
                }

                if (parsed?.segments && Array.isArray(parsed.segments) && parsed.segments.length > 0) {
                  dialogueCues = parsed.segments.map((s) => ({
                    startSec: Number(s.start || 0),
                    endSec: Number(s.end || (Number(s.start || 0) + 3.0)),
                    text: s.text || '',
                    translated: s.translated || ''
                  }));
                  if (parsed.detectedGender && currentGender === 'auto') {
                    currentGender = parsed.detectedGender.toLowerCase();
                  }
                  console.log(`[Gemini] Successfully retrieved ${dialogueCues.length} timestamped cues!`);
                  break;
                }
              }
            } catch (callErr) {
              console.warn(`[Gemini] Call to ${endpoint.name} failed:`, callErr.message);
            }
          }
        }
      } catch (geminiErr) {
        console.warn('[Dubber] Gemini audio speech recognition failed:', geminiErr.message);
      }
    }

    // Fallback: If transcript text was provided without timestamps, split into sentences
    if (dialogueCues.length === 0 && transcriptText && transcriptText.trim()) {
      const sentences = transcriptText.trim().split(/(?<=[.?!])\s+/).filter(Boolean);
      const estStart = (startOffset !== undefined && !isNaN(Number(startOffset))) ? Number(startOffset) : 5.0;
      let pos = estStart;
      for (const sent of sentences) {
        const dur = Math.max(2.5, sent.length * 0.08);
        dialogueCues.push({
          startSec: pos,
          endSec: pos + dur,
          text: sent
        });
        pos += dur + 1.2;
      }
    }

    if (dialogueCues.length === 0) {
      const errorMsg = effectiveApiKey
        ? 'Could not automatically detect dialogue timestamps in the audio file. Please download the matching English subtitles (.srt) or paste the dialogue in the transcript box.'
        : 'Exact dialogue timing requires subtitles or a free Gemini API key to listen to the audio track. Please click "Add Free API Key" at the top of the Dubbing & TTS page, or paste the subtitles/transcript.';
      return onError(new Error(errorMsg));
    }

    if (abortController.aborted) return;

    // -------------------------------------------------------------
    // STAGE 3: Batch Translation to Target Language (Hindi/Gujarati)
    // -------------------------------------------------------------
    onProgress({
      percent: '45%',
      status: 'processing',
      message: `Stage 3/5: Translating ${dialogueCues.length} dialogue lines to ${targetLanguage === 'gu' ? 'Gujarati' : 'Hindi'}...`
    });

    const cuesNeedingTranslation = dialogueCues.filter((c) => !c.translated || !c.translated.trim());
    if (cuesNeedingTranslation.length > 0) {
      const combinedLines = dialogueCues.map((c) => c.text).join('\n###\n');
      try {
        const translatedCombined = await translateTextFree(combinedLines, targetLanguage);
        const translatedParts = translatedCombined.split(/###|\n###\n/).map((p) => p.trim()).filter(Boolean);

        if (translatedParts.length === dialogueCues.length) {
          for (let i = 0; i < dialogueCues.length; i++) {
            dialogueCues[i].translated = translatedParts[i];
          }
        } else {
          // If batch delimiter splitting had mismatch, translate one-by-one
          for (let i = 0; i < dialogueCues.length; i++) {
            dialogueCues[i].translated = await translateTextFree(dialogueCues[i].text, targetLanguage);
          }
        }
      } catch (transErr) {
        console.warn('[Dubber] Batch translation failed, attempting individual translation:', transErr.message);
        for (let i = 0; i < dialogueCues.length; i++) {
          try {
            dialogueCues[i].translated = await translateTextFree(dialogueCues[i].text, targetLanguage);
          } catch (e) {
            dialogueCues[i].translated = dialogueCues[i].text;
          }
        }
      }
    }

    if (abortController.aborted) return;

    // -------------------------------------------------------------
    // STAGE 4: Time-Aligned Voice Synthesis with Edge TTS
    // -------------------------------------------------------------
    const chosenGender = (currentGender === 'female') ? 'female' : 'male';
    const langKey = targetLanguage === 'gu' ? 'gu' : 'hi';
    const voiceId = VOICE_ROSTER[langKey][chosenGender].id;

    onProgress({
      percent: '60%',
      status: 'processing',
      message: `Stage 4/5: Synthesizing ${chosenGender} ${VOICE_ROSTER[langKey][chosenGender].name} voice aligned to scene timing...`
    });

    const tempSegFiles = [];
    const activeIntervals = [];

    for (let i = 0; i < dialogueCues.length; i++) {
      if (abortController.aborted) return;
      const cue = dialogueCues[i];
      const nextCue = dialogueCues[i + 1];
      const slotDuration = Math.max(1.0, cue.endSec - cue.startSec);
      const maxAvailableSlot = nextCue
        ? Math.max(slotDuration, nextCue.startSec - cue.startSec - 0.2)
        : slotDuration + 3.0;

      // Dynamic pacing: if Hindi phrasing is longer than available slot, adjust speech rate
      let speedRate = '+0%';
      const estDuration = (cue.translated || '').length * 0.085;
      if (estDuration > maxAvailableSlot * 1.1) {
        const speedUp = Math.min(38, Math.round(((estDuration / maxAvailableSlot) - 1.0) * 100));
        speedRate = `+${Math.max(8, speedUp)}%`;
      }

      const tts = await synthesizeSpeechWithRetry(cue.translated || cue.text, voiceId, { rate: speedRate, pitch: '+0Hz' });
      const segMp3 = path.join(tempDir, `temp_${jobId}_seg_${i}.mp3`);
      const segWav = path.join(tempDir, `temp_${jobId}_seg_${i}.wav`);
      abortController.tempFiles.push(segMp3, segWav);

      await tts.toFile(segMp3);

      // Convert each segment to standard 44.1kHz stereo WAV
      spawnSync(ffmpegPath, ['-i', segMp3, '-ar', '44100', '-ac', '2', '-y', segWav], { windowsHide: true });

      // Measure exact generated audio duration
      const prWav = spawnSync(ffmpegPath, ['-i', segWav], { encoding: 'utf8', windowsHide: true });
      const mWav = (prWav.stderr || '').match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
      const actualDur = mWav
        ? parseInt(mWav[1]) * 3600 + parseInt(mWav[2]) * 60 + parseInt(mWav[3]) + parseInt(mWav[4]) / 100
        : slotDuration;

      tempSegFiles.push({ segWav, startSec: cue.startSec, dur: actualDur });
      activeIntervals.push({ start: cue.startSec, end: cue.startSec + actualDur });

      if (i % 3 === 0 || i === dialogueCues.length - 1) {
        onProgress({
          percent: `${60 + Math.round((i / dialogueCues.length) * 20)}%`,
          status: 'processing',
          message: `Stage 4/5: Synthesized dialogue segment ${i + 1}/${dialogueCues.length} (${cue.startSec.toFixed(1)}s)...`
        });
      }
    }

    if (abortController.aborted) return;

    // -------------------------------------------------------------
    // STAGE 5: Concatenating Full Timed Voice Track & Studio Mix
    // -------------------------------------------------------------
    onProgress({
      percent: '82%',
      status: 'processing',
      message: 'Stage 5/5: Building timeline and mixing with 100% preserved background music & sound effects...'
    });

    // Build timeline parts: gaps of digital silence between dialogue segments
    const concatInputs = [];
    let currentPos = 0;

    for (let i = 0; i < tempSegFiles.length; i++) {
      const s = tempSegFiles[i];
      const gap = s.startSec - currentPos;
      if (gap > 0.02) {
        const gapFile = path.join(tempDir, `temp_${jobId}_gap_${i}.wav`);
        abortController.tempFiles.push(gapFile);
        spawnSync(ffmpegPath, ['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-t', gap.toFixed(3), '-y', gapFile], { windowsHide: true });
        concatInputs.push(gapFile);
        currentPos += gap;
      }
      concatInputs.push(s.segWav);
      currentPos += s.dur;
    }

    const effectiveTotalDur = Math.max(totalDurationSec, currentPos);
    if (currentPos < effectiveTotalDur) {
      const finalGap = effectiveTotalDur - currentPos;
      const finalGapFile = path.join(tempDir, `temp_${jobId}_gap_final.wav`);
      abortController.tempFiles.push(finalGapFile);
      spawnSync(ffmpegPath, ['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-t', finalGap.toFixed(3), '-y', finalGapFile], { windowsHide: true });
      concatInputs.push(finalGapFile);
      currentPos += finalGap;
    }

    const concatListFile = path.join(tempDir, `temp_${jobId}_concat_list.txt`);
    abortController.tempFiles.push(concatListFile);
    fs.writeFileSync(concatListFile, concatInputs.map((f) => `file '${f.replace(/\\/g, '/')}'`).join('\n'));

    const fullTimedVoiceWav = path.join(tempDir, `temp_${jobId}_full_voice.wav`);
    abortController.tempFiles.push(fullTimedVoiceWav);
    spawnSync(ffmpegPath, ['-f', 'concat', '-safe', '0', '-i', concatListFile, '-c', 'copy', '-y', fullTimedVoiceWav], { windowsHide: true });

    // Background track source:
    // If Demucs separated no_vocals.wav exists, use it. Otherwise, use original audio with dynamic speech ducking!
    const bgSource = (demucsBgPath && fs.existsSync(demucsBgPath)) ? demucsBgPath : resolvedInput;
    const userBgVol = Number(bgVolume) || 1.0;

    let filterGraph;
    if (demucsBgPath && fs.existsSync(demucsBgPath)) {
      // Demucs background already has 0% vocals: full volume throughout!
      filterGraph = `[0:a]volume=${(userBgVol).toFixed(2)}[bg];[1:a]volume=1.3[voice];[bg][voice]amix=inputs=2:duration=first:dropout_transition=0:weights=1 1,volume=2.0[out]`;
    } else {
      // Dynamic Ducking:
      // Outside dialogue intervals (intro, pauses, fight scenes, climax): volume is 100% full untouched original!
      // During active dialogue intervals: duck background to 0.26 * bgVolume so translated voice is loud and clear,
      // and original English dialogue is suppressed while background instruments remain hearable!
      const conds = activeIntervals.map((inv) => `between(t,${inv.start.toFixed(2)},${inv.end.toFixed(2)})`).join('+');
      const duckLevel = (0.26 * Math.max(0.1, userBgVol)).toFixed(3);
      const normalLevel = (1.0 * Math.max(0.1, userBgVol)).toFixed(3);
      const duckExpr = `if(${conds},${duckLevel},${normalLevel})`;

      filterGraph = `[0:a]volume=eval=frame:volume='${duckExpr}'[ducked_bg];[1:a]volume=1.3[voice];[ducked_bg][voice]amix=inputs=2:duration=first:dropout_transition=0:weights=1 1,volume=2.0[out]`;
    }

    const mixArgs = [
      '-i', bgSource,
      '-i', fullTimedVoiceWav,
      '-filter_complex', filterGraph,
      '-map', '[out]',
      '-c:a', 'libmp3lame',
      '-b:a', '192k',
      '-y', targetFilePath
    ];

    const mixProc = spawn(ffmpegPath, mixArgs, { windowsHide: true });
    abortController.processes.push(mixProc);

    let ffmpegStderr = '';
    if (mixProc.stderr) {
      mixProc.stderr.on('data', (d) => {
        ffmpegStderr += d.toString();
      });
    }

    mixProc.on('close', (code) => {
      // Cleanup temp files
      for (const f of abortController.tempFiles) {
        try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (e) {}
      }
      activeDubbingJobs.delete(jobId);

      if (code === 0 && fs.existsSync(targetFilePath)) {
        const stats = fs.statSync(targetFilePath);
        const translatedSnippet = dialogueCues.map((c) => c.translated).slice(0, 3).join(' ') + '...';
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
          hasBackgroundTrack: true,
          cuesCount: dialogueCues.length,
          translatedSnippet,
          status: 'completed'
        });
      } else {
        console.error('[Dubber] Audio mixing error:', ffmpegStderr.slice(-400));
        onError(new Error(`Audio mixing failed: ${ffmpegStderr.slice(-250) || `exit code ${code}`}`));
      }
    });

    mixProc.on('error', (err) => {
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
