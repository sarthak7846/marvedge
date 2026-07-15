"use strict";

const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { randomUUID } = require("node:crypto");

const express = require("express");
const { Storage } = require("@google-cloud/storage");
const { Firestore, FieldValue } = require("@google-cloud/firestore");
const { renderChunkFromRecipe } = require("./render");

const storage = new Storage();
const firestore = new Firestore();

const PORT = Number(process.env.PORT || 8080);
const RAW_BUCKET = process.env.RAW_BUCKET || "";
const PROCESSED_BUCKET = process.env.PROCESSED_BUCKET || "";
const RAW_PREFIX = process.env.RAW_PREFIX || "";
const PROCESSED_PREFIX = process.env.PROCESSED_PREFIX || "";
const RECIPES_COLLECTION = process.env.RECIPES_COLLECTION || "recipes";
const CHUNKS_COLLECTION = process.env.CHUNKS_COLLECTION || "chunks";
const CHUNK_DURATION_SECS = Number(process.env.CHUNK_DURATION_SECS || 10);
// GCS object prefix for AVS voiceover MP3s (in the processed bucket).
const AVS_VOICEOVER_PREFIX = process.env.AVS_VOICEOVER_PREFIX || "avs-voiceover/";
// GCS object prefix for AVS time-aligned MP4s (in the processed bucket).
const AVS_ALIGNED_PREFIX = process.env.AVS_ALIGNED_PREFIX || "avs-aligned/";
// Frame rate the aligned segments are normalized to so they concat with -c copy.
const AVS_SYNC_FPS = Number(process.env.AVS_SYNC_FPS || 30);
// Deepgram Aura per-request text cap. The API rejects very long text, so we
// split a step's narration at sentence boundaries to stay comfortably under it.
const AURA_CHAR_LIMIT = Number(process.env.AURA_CHAR_LIMIT || 1800);
// Deepgram Aura English voices exposed by the panel; anything else falls back.
const AVS_DEFAULT_VOICE = "aura-2-thalia-en";
const AVS_ALLOWED_VOICES = new Set([
  "aura-2-thalia-en",
  "aura-2-andromeda-en",
  "aura-2-helena-en",
  "aura-2-apollo-en",
  "aura-2-arcas-en",
]);
const execFileAsync = promisify(execFile);

function must(name, value) {
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

async function downloadRawChunkFromGcs({
  bucketName,
  objectName,
  destinationPath,
}) {
  await storage
    .bucket(bucketName)
    .file(objectName)
    .download({ destination: destinationPath });
}

function parseGsUri(uri) {
  if (typeof uri !== "string" || !uri.startsWith("gs://")) {
    return null;
  }
  const trimmed = uri.slice("gs://".length);
  const slashIndex = trimmed.indexOf("/");
  if (slashIndex <= 0) {
    return null;
  }
  const bucket = trimmed.slice(0, slashIndex);
  const object = trimmed.slice(slashIndex + 1);
  if (!bucket || !object) {
    return null;
  }
  return { bucket, object };
}

async function downloadFromGsUri({ uri, destinationPath }) {
  const parsed = parseGsUri(uri);
  if (!parsed) {
    throw new Error(`Invalid gs:// uri: ${uri}`);
  }
  await downloadRawChunkFromGcs({
    bucketName: parsed.bucket,
    objectName: parsed.object,
    destinationPath,
  });
}

async function getSignedHttpUrlForGsUri(uri) {
  const parsed = parseGsUri(uri);
  if (!parsed) {
    throw new Error(`Invalid gs:// uri: ${uri}`);
  }
  const [signedUrl] = await storage
    .bucket(parsed.bucket)
    .file(parsed.object)
    .getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + 2 * 60 * 60 * 1000,
    });
  return signedUrl;
}

async function downloadFromUrl({ url, destinationPath }) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download source video: ${response.status}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(destinationPath, bytes);
}

async function extractAudioWav16kMono(inputPath, wavPath) {
  await execFileAsync("/usr/bin/ffmpeg", [
    "-y",
    "-i",
    inputPath,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-c:a",
    "pcm_s16le",
    wavPath,
  ]);
}

function cuesFromDeepgramWords(words) {
  if (!Array.isArray(words) || words.length === 0) return [];
  const cues = [];
  let cueStart = Number(words[0].start || 0);
  let cueEnd = Number(words[0].end || cueStart + 0.3);
  let text = String(words[0].punctuated_word || words[0].word || "").trim();

  for (let i = 1; i < words.length; i++) {
    const w = words[i];
    const wText = String(w.punctuated_word || w.word || "").trim();
    const wStart = Number(w.start || cueEnd);
    const wEnd = Number(w.end || wStart + 0.25);
    const gap = wStart - cueEnd;
    const nextTextLen = (text + " " + wText).trim().length;
    const cueDur = cueEnd - cueStart;
    const shouldBreak = gap > 0.8 || cueDur > 4.2 || nextTextLen > 56;

    if (shouldBreak && text) {
      cues.push({
        start: Math.max(0, cueStart),
        end: Math.max(cueStart + 0.04, cueEnd),
        text: text.trim(),
      });
      cueStart = wStart;
      cueEnd = wEnd;
      text = wText;
    } else {
      cueEnd = Math.max(cueEnd, wEnd);
      text = `${text} ${wText}`.trim();
    }
  }

  if (text) {
    cues.push({
      start: Math.max(0, cueStart),
      end: Math.max(cueStart + 0.04, cueEnd),
      text: text.trim(),
    });
  }
  return cues.filter((c) => c.text.length > 0 && c.end - c.start > 0.01);
}

async function transcribeWithDeepgram(wavPath, language = "multi") {
  const apiKey = (process.env.DEEPGRAM_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("Missing DEEPGRAM_API_KEY in Cloud Run environment");
  }

  const params = new URLSearchParams({
    model: "nova-2",
    punctuate: "true",
    smart_format: "true",
  });
  if (language && language !== "multi") {
    params.set("language", language);
  } else {
    params.set("detect_language", "true");
  }

  const audio = await fs.readFile(wavPath);
  const resp = await fetch(
    `https://api.deepgram.com/v1/listen?${params.toString()}`,
    {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "audio/wav",
      },
      body: audio,
    },
  );

  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(
      `Deepgram failed (${resp.status}): ${typeof body === "object" ? JSON.stringify(body) : String(body)}`,
    );
  }

  const words = body?.results?.channels?.[0]?.alternatives?.[0]?.words || [];
  const cues = cuesFromDeepgramWords(words);
  if (cues.length > 0) return cues;

  const transcript = String(
    body?.results?.channels?.[0]?.alternatives?.[0]?.transcript || "",
  ).trim();
  if (!transcript) return [];
  return [{ start: 0, end: 3, text: transcript }];
}

async function processSubtitlesJob({ videoUrl, language }) {
  if (!videoUrl) throw new Error("videoUrl is required");
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "marvedge-subtitles-"),
  );
  const inputPath = path.join(tempDir, "input.webm");
  const wavPath = path.join(tempDir, "audio.wav");
  const startedAt = Date.now();
  try {
    const dlStart = Date.now();
    if (typeof videoUrl === "string" && videoUrl.startsWith("gs://")) {
      await downloadFromGsUri({
        uri: String(videoUrl),
        destinationPath: inputPath,
      });
    } else {
      await downloadFromUrl({
        url: String(videoUrl),
        destinationPath: inputPath,
      });
    }
    const dlMs = Date.now() - dlStart;

    const exStart = Date.now();
    await extractAudioWav16kMono(inputPath, wavPath);
    const extractMs = Date.now() - exStart;

    const dgStart = Date.now();
    const cues = await transcribeWithDeepgram(
      wavPath,
      String(language || "multi"),
    );
    const deepgramMs = Date.now() - dgStart;

    console.log(
      `[subtitles] Timing download_ms=${dlMs} extract_ms=${extractMs} deepgram_ms=${deepgramMs} total_ms=${Date.now() - startedAt} cues=${cues.length}`,
    );
    return cues;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function uploadProcessedChunkToGcs({
  bucketName,
  objectName,
  sourcePath,
}) {
  await storage.bucket(bucketName).upload(sourcePath, {
    destination: objectName,
    contentType: "video/mp4",
    resumable: false,
  });
}

// --- AVS voiceover (Deepgram Aura TTS) -------------------------------------

/** Clamp an arbitrary voice id to an allowed Aura model, defaulting safely. */
function normalizeVoiceId(voiceId) {
  const v = String(voiceId || "").trim();
  return AVS_ALLOWED_VOICES.has(v) ? v : AVS_DEFAULT_VOICE;
}

/**
 * Apply the pronunciation dictionary before TTS: each rule's `term` is swapped
 * for its `phonetic` spelling (case-insensitive, whole-word). Longer terms are
 * applied first so multi-word terms win over their constituent words.
 */
function applyPronunciation(text, rules) {
  if (!Array.isArray(rules) || rules.length === 0) {
    return text;
  }
  let out = String(text || "");
  const sorted = [...rules]
    .filter((r) => r && typeof r.term === "string" && typeof r.phonetic === "string")
    .sort((a, b) => b.term.length - a.term.length);
  for (const rule of sorted) {
    const term = rule.term.trim();
    if (!term) continue;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${escaped}\\b`, "gi");
    // Function replacer so a `$` in the phonetic spelling isn't treated as a
    // special replacement pattern (e.g. `$&`).
    out = out.replace(re, () => rule.phonetic);
  }
  return out;
}

/**
 * Split text into chunks no longer than `limit`, preferring sentence
 * boundaries. A single over-length sentence is hard-split on whitespace so we
 * never exceed the Aura request cap.
 */
function splitTextForAura(text, limit = AURA_CHAR_LIMIT) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return [];
  if (trimmed.length <= limit) return [trimmed];

  const sentences = trimmed.match(/[^.!?]+[.!?]+|\S[^.!?]*$/g) || [trimmed];
  const chunks = [];
  let current = "";

  const flush = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };

  for (const raw of sentences) {
    const sentence = raw.trim();
    if (!sentence) continue;

    if (sentence.length > limit) {
      flush();
      let word = "";
      for (const w of sentence.split(/\s+/)) {
        if ((`${word} ${w}`).trim().length > limit) {
          if (word) chunks.push(word);
          word = w;
        } else {
          word = (`${word} ${w}`).trim();
        }
      }
      if (word) chunks.push(word);
      continue;
    }

    if ((`${current} ${sentence}`).trim().length > limit) {
      flush();
      current = sentence;
    } else {
      current = (`${current} ${sentence}`).trim();
    }
  }
  flush();
  return chunks.length > 0 ? chunks : [trimmed];
}

/** Synthesize one text chunk to an MP3 file via Deepgram Aura `/v1/speak`. */
async function synthesizeAuraChunk(text, voiceId, outputPath) {
  const apiKey = (process.env.DEEPGRAM_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("Missing DEEPGRAM_API_KEY in Cloud Run environment");
  }
  const params = new URLSearchParams({ model: voiceId, encoding: "mp3" });
  const resp = await fetch(`https://api.deepgram.com/v1/speak?${params.toString()}`, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });
  if (!resp.ok) {
    const errBody = await resp.text().catch(() => "");
    throw new Error(`Deepgram Aura failed (${resp.status}): ${errBody}`);
  }
  const bytes = Buffer.from(await resp.arrayBuffer());
  await fs.writeFile(outputPath, bytes);
}

/** Probe an audio file's duration (seconds) via ffprobe. */
async function probeDurationSeconds(filePath) {
  const { stdout } = await execFileAsync("/usr/bin/ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);
  const d = Number(String(stdout).trim());
  return Number.isFinite(d) && d > 0 ? d : 0;
}

/** Concatenate MP3 files into one via the ffmpeg concat demuxer (stream copy). */
async function concatMp3(inputPaths, outputPath, workDir, tag) {
  if (inputPaths.length === 1) {
    await fs.copyFile(inputPaths[0], outputPath);
    return;
  }
  const listPath = path.join(workDir, `concat-${tag}.txt`);
  const listContent = inputPaths
    .map((p) => `file '${p.replace(/'/g, "'\\''")}'`)
    .join("\n");
  await fs.writeFile(listPath, listContent);
  await execFileAsync("/usr/bin/ffmpeg", [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listPath,
    "-c",
    "copy",
    outputPath,
  ]);
}

async function uploadVoiceoverToGcs({ bucketName, objectName, sourcePath }) {
  await storage.bucket(bucketName).upload(sourcePath, {
    destination: objectName,
    contentType: "audio/mpeg",
    resumable: false,
  });
}

const round3 = (n) => Math.round(n * 1000) / 1000;

/**
 * Turn a per-step script into ONE continuous MP3 voiceover:
 *  - apply the pronunciation dictionary, then Aura TTS each step (splitting long
 *    text at sentence boundaries and synthesizing chunks in parallel);
 *  - concat each step's chunks, probe its duration, and accumulate stepTimings;
 *  - concat all step MP3s into one file, upload to GCS, and return the result.
 * Steps with empty narration are skipped. Falls back to one segment when the
 * caller sends a single line (the no-steps case).
 */
async function processVoiceoverJob({ lines, voiceId, pronunciation }) {
  const processedBucket = must("PROCESSED_BUCKET", PROCESSED_BUCKET);
  const model = normalizeVoiceId(voiceId);

  const cleanLines = (Array.isArray(lines) ? lines : [])
    .map((l) => ({
      stepId: String((l && l.stepId) || "").trim(),
      text: String((l && l.text) || "").trim(),
    }))
    .filter((l) => l.stepId && l.text);

  if (cleanLines.length === 0) {
    throw new Error("No script lines to synthesize");
  }

  const startedAt = Date.now();
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "marvedge-avs-voice-"));
  try {
    const stepMp3Paths = [];
    const stepTimings = [];
    let cursor = 0;

    for (let s = 0; s < cleanLines.length; s++) {
      const { stepId, text } = cleanLines[s];
      const spoken = applyPronunciation(text, pronunciation);
      const chunks = splitTextForAura(spoken);
      if (chunks.length === 0) continue;

      const chunkPaths = await Promise.all(
        chunks.map(async (chunkText, ci) => {
          const p = path.join(workDir, `step-${s}-chunk-${ci}.mp3`);
          await synthesizeAuraChunk(chunkText, model, p);
          return p;
        }),
      );

      const stepPath = path.join(workDir, `step-${s}.mp3`);
      await concatMp3(chunkPaths, stepPath, workDir, `step-${s}`);
      const dur = await probeDurationSeconds(stepPath);

      stepMp3Paths.push(stepPath);
      stepTimings.push({
        stepId,
        start: round3(cursor),
        end: round3(cursor + dur),
      });
      cursor += dur;
    }

    if (stepMp3Paths.length === 0) {
      throw new Error("No audio was produced for the script");
    }

    const finalPath = path.join(workDir, "voiceover.mp3");
    await concatMp3(stepMp3Paths, finalPath, workDir, "final");
    const probed = await probeDurationSeconds(finalPath);
    const duration = probed > 0 ? round3(probed) : round3(cursor);

    const objectName = `${AVS_VOICEOVER_PREFIX}${randomUUID()}.mp3`;
    await uploadVoiceoverToGcs({
      bucketName: processedBucket,
      objectName,
      sourcePath: finalPath,
    });

    const fileRef = storage.bucket(processedBucket).file(objectName);
    try {
      await fileRef.makePublic();
    } catch (e) {
      /* Ignore if UBLA is enforced; a signed/authorized URL still works. */
    }
    const audioUrl = `https://storage.googleapis.com/${processedBucket}/${objectName}`;

    console.log(
      `[avs-voiceover] steps=${stepTimings.length} duration=${duration}s ` +
        `voice=${model} total_ms=${Date.now() - startedAt}`,
    );

    return { audioUrl, duration, stepTimings };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

// --- AVS time-alignment (freeze-frame / silence) ---------------------------

/** Sanitize + time-sort the incoming steps, dropping ones with an invalid span. */
function normalizeSyncSteps(steps) {
  return (Array.isArray(steps) ? steps : [])
    .map((s) => ({
      id: String((s && s.id) || "").trim(),
      startTime: Number(s && s.startTime),
      endTime: Number(s && s.endTime),
    }))
    .filter(
      (s) =>
        s.id &&
        Number.isFinite(s.startTime) &&
        Number.isFinite(s.endTime) &&
        s.endTime > s.startTime,
    )
    .sort((a, b) => a.startTime - b.startTime);
}

/** Build a stepId -> {start,end} lookup from the voiceover stepTimings. */
function buildTimingMap(stepTimings) {
  const map = new Map();
  for (const t of Array.isArray(stepTimings) ? stepTimings : []) {
    const stepId = String((t && t.stepId) || "").trim();
    const start = Number(t && t.start);
    const end = Number(t && t.end);
    if (stepId && Number.isFinite(start) && Number.isFinite(end) && end > start) {
      map.set(stepId, { start, end });
    }
  }
  return map;
}

/**
 * Build one step's ALIGNED VIDEO segment (video-only, re-encoded to a uniform
 * H.264 so segments concat with -c copy). The [start, start+videoDur] slice of
 * the source is extended by `freeze` seconds of the cloned last frame (tpad) so
 * the segment lasts exactly max(T_video, T_audio).
 */
async function buildAlignedVideoSegment({ sourcePath, start, videoDur, freeze, outputPath }) {
  const filters = [`fps=${AVS_SYNC_FPS}`, "format=yuv420p", "setsar=1"];
  if (freeze > 0.001) {
    filters.push(`tpad=stop_mode=clone:stop_duration=${round3(freeze)}`);
  }
  await execFileAsync("/usr/bin/ffmpeg", [
    "-y",
    "-ss",
    String(round3(start)),
    "-t",
    String(round3(videoDur)),
    "-i",
    sourcePath,
    "-an",
    "-vf",
    filters.join(","),
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "20",
    "-pix_fmt",
    "yuv420p",
    "-r",
    String(AVS_SYNC_FPS),
    "-video_track_timescale",
    "15360",
    outputPath,
  ]);
}

/**
 * Build one step's ALIGNED AUDIO segment as a PCM WAV of length `totalDur`.
 * When the step has voiceover, its [audioStart, audioStart+audioDur] slice is
 * padded with trailing silence (apad) up to totalDur; otherwise the whole
 * segment is silence. PCM avoids the per-boundary priming drift that repeated
 * AAC concat would introduce, so A/V stay in sync across many steps.
 */
async function buildAlignedAudioSegment({ voicePath, audioStart, audioDur, totalDur, outputPath }) {
  if (voicePath && audioDur > 0.001) {
    await execFileAsync("/usr/bin/ffmpeg", [
      "-y",
      "-ss",
      String(round3(audioStart)),
      "-t",
      String(round3(audioDur)),
      "-i",
      voicePath,
      "-af",
      `aformat=sample_rates=48000:channel_layouts=stereo,apad=whole_dur=${round3(totalDur)}`,
      "-c:a",
      "pcm_s16le",
      outputPath,
    ]);
    return;
  }
  await execFileAsync("/usr/bin/ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-t",
    String(round3(totalDur)),
    "-i",
    "anullsrc=channel_layout=stereo:sample_rate=48000",
    "-c:a",
    "pcm_s16le",
    outputPath,
  ]);
}

/** Concatenate media files of identical codecs via the ffmpeg concat demuxer (stream copy). */
async function concatByDemuxer(inputPaths, outputPath, workDir, tag) {
  if (inputPaths.length === 1) {
    await fs.copyFile(inputPaths[0], outputPath);
    return;
  }
  const listPath = path.join(workDir, `concat-${tag}.txt`);
  const listContent = inputPaths
    .map((p) => `file '${p.replace(/'/g, "'\\''")}'`)
    .join("\n");
  await fs.writeFile(listPath, listContent);
  await execFileAsync("/usr/bin/ffmpeg", [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listPath,
    "-c",
    "copy",
    outputPath,
  ]);
}

async function downloadToPath(url, destinationPath) {
  if (String(url).startsWith("gs://")) {
    await downloadFromGsUri({ uri: String(url), destinationPath });
  } else {
    await downloadFromUrl({ url: String(url), destinationPath });
  }
}

/**
 * Time-align the continuous voiceover to the video per step (AVS-2.4):
 *  - T_audio > T_video → freeze the step's last frame for the overflow;
 *  - T_video > T_audio → pad the step's voiceover with trailing silence;
 * so each step lasts max(T_video, T_audio) and audio/video stay in sync
 * end-to-end. Video segments (with freeze) and audio segments (with silence)
 * are concatenated separately, then the continuous aligned audio is muxed onto
 * the continuous video → ONE aligned MP4 (the source the normal export then
 * processes). Returns { alignedVideoUrl, duration }. FALLBACK: no voiceover /
 * steps → the original source is returned unchanged.
 */
async function processSyncJob({ videoUrl, audioUrl, steps, stepTimings }) {
  if (!videoUrl) throw new Error("videoUrl is required");

  const stepList = normalizeSyncSteps(steps);
  const timingMap = buildTimingMap(stepTimings);

  // Fallback: nothing to align → hand back the original source untouched.
  if (!audioUrl || stepList.length === 0 || timingMap.size === 0) {
    return { alignedVideoUrl: videoUrl, duration: 0 };
  }

  const processedBucket = must("PROCESSED_BUCKET", PROCESSED_BUCKET);
  const startedAt = Date.now();
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "marvedge-avs-sync-"));
  try {
    const sourcePath = path.join(workDir, "source.mp4");
    await downloadToPath(videoUrl, sourcePath);
    const voicePath = path.join(workDir, "voiceover.mp3");
    await downloadToPath(audioUrl, voicePath);

    const videoSegments = [];
    const audioSegments = [];
    let frozen = 0;
    let padded = 0;

    for (let i = 0; i < stepList.length; i++) {
      const step = stepList[i];
      const tVideo = round3(step.endTime - step.startTime);
      if (tVideo <= 0) continue;

      const timing = timingMap.get(step.id);
      const tAudio = timing ? round3(timing.end - timing.start) : 0;
      const total = Math.max(tVideo, tAudio);
      const freeze = Math.max(0, round3(tAudio - tVideo));
      if (freeze > 0) frozen++;
      if (tVideo > tAudio) padded++;

      const vSeg = path.join(workDir, `vseg-${i}.mp4`);
      await buildAlignedVideoSegment({
        sourcePath,
        start: step.startTime,
        videoDur: tVideo,
        freeze,
        outputPath: vSeg,
      });
      videoSegments.push(vSeg);

      const aSeg = path.join(workDir, `aseg-${i}.wav`);
      await buildAlignedAudioSegment({
        voicePath,
        audioStart: timing ? timing.start : 0,
        audioDur: tAudio,
        totalDur: total,
        outputPath: aSeg,
      });
      audioSegments.push(aSeg);
    }

    if (videoSegments.length === 0) {
      throw new Error("No alignable steps were produced");
    }

    const videoPath = path.join(workDir, "aligned-video.mp4");
    await concatByDemuxer(videoSegments, videoPath, workDir, "video");
    const audioPath = path.join(workDir, "aligned-audio.wav");
    await concatByDemuxer(audioSegments, audioPath, workDir, "audio");

    const alignedPath = path.join(workDir, "aligned.mp4");
    await execFileAsync("/usr/bin/ffmpeg", [
      "-y",
      "-i",
      videoPath,
      "-i",
      audioPath,
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-b:a",
      "160k",
      "-ar",
      "48000",
      "-ac",
      "2",
      "-movflags",
      "+faststart",
      alignedPath,
    ]);

    const duration = round3(await probeDurationSeconds(alignedPath));

    const objectName = `${AVS_ALIGNED_PREFIX}${randomUUID()}.mp4`;
    await uploadProcessedChunkToGcs({
      bucketName: processedBucket,
      objectName,
      sourcePath: alignedPath,
    });
    const fileRef = storage.bucket(processedBucket).file(objectName);
    try {
      await fileRef.makePublic();
    } catch (e) {
      /* Ignore if UBLA is enforced; a signed/authorized URL still works. */
    }
    const alignedVideoUrl = `https://storage.googleapis.com/${processedBucket}/${objectName}`;

    console.log(
      `[avs-sync] steps=${videoSegments.length} frozen=${frozen} padded=${padded} ` +
        `duration=${duration}s total_ms=${Date.now() - startedAt}`,
    );

    return { alignedVideoUrl, duration };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function getRecipeById(recipeId) {
  const snap = await firestore
    .collection(RECIPES_COLLECTION)
    .doc(recipeId)
    .get();
  if (!snap.exists) {
    throw new Error(`Recipe not found: ${recipeId}`);
  }
  return snap.data() || {};
}

async function updateChunkStatus(chunkId, patch) {
  await firestore
    .collection(CHUNKS_COLLECTION)
    .doc(chunkId)
    .set(
      {
        ...patch,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
}

async function processChunkJob({
  chunkId,
  recipeId,
  rawObject,
  outputObject,
  recipe: inlineRecipe,
  videoUrl,
  startTime,
  duration,
}) {
  const totalStartMs = Date.now();
  const rawBucket = must("RAW_BUCKET", RAW_BUCKET);
  const processedBucket = must("PROCESSED_BUCKET", PROCESSED_BUCKET);
  const recipe = inlineRecipe || (await getRecipeById(recipeId));

  const sourceObject = rawObject || `${RAW_PREFIX}${chunkId}.webm`;
  const destObject = outputObject || `${PROCESSED_PREFIX}${chunkId}.mp4`;

  await updateChunkStatus(chunkId, {
    recipeId,
    status: "PROCESSING",
    rawBucket,
    rawObject: sourceObject,
    sourceUrl: videoUrl || null,
    error: FieldValue.delete(),
  });

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "marvedge-gcp-"));
  let inputPath = path.join(workDir, "input.webm");
  const outputPath = path.join(workDir, "output.mp4");

  try {
    const dlStartMs = Date.now();
    let dlMs = 0;

    if (
      typeof startTime === "number" &&
      typeof duration === "number" &&
      videoUrl
    ) {
      // Logical splitting: Skip physical download, use URL directly as inputPath.
      // For gs:// sources, sign URL so ffmpeg can stream it.
      if (String(videoUrl).startsWith("gs://")) {
        inputPath = await getSignedHttpUrlForGsUri(String(videoUrl));
      } else {
        inputPath = String(videoUrl);
      }
    } else if (videoUrl) {
      if (String(videoUrl).startsWith("gs://")) {
        await downloadFromGsUri({
          uri: String(videoUrl),
          destinationPath: inputPath,
        });
      } else {
        await downloadFromUrl({
          url: String(videoUrl),
          destinationPath: inputPath,
        });
      }
      dlMs = Date.now() - dlStartMs;
    } else {
      await downloadRawChunkFromGcs({
        bucketName: rawBucket,
        objectName: sourceObject,
        destinationPath: inputPath,
      });
      dlMs = Date.now() - dlStartMs;
    }

    let inputBytes = 0;
    try {
      inputBytes = (await fs.stat(inputPath)).size;
    } catch {
      // Ignore stats failures.
    }

    const renderStartMs = Date.now();
    const renderResult = await renderChunkFromRecipe({
      inputPath,
      outputPath,
      chunkId,
      recipe,
      chunkDurationSecs: CHUNK_DURATION_SECS,
      startTime,
      duration,
    });
    const renderMs = Date.now() - renderStartMs;

    if (renderResult && renderResult.skipped) {
      console.log(`[${chunkId}] Chunk was skipped. Not uploading.`);
      await updateChunkStatus(chunkId, {
        recipeId,
        status: "SKIPPED",
        error: FieldValue.delete(),
      });
      return {
        chunkId,
        recipeId,
        status: "SKIPPED",
        skipped: true,
      };
    }

    let outputBytes = 0;
    try {
      outputBytes = (await fs.stat(outputPath)).size;
    } catch {
      // Ignore stats failures.
    }

    const uploadStartMs = Date.now();
    await uploadProcessedChunkToGcs({
      bucketName: processedBucket,
      objectName: destObject,
      sourcePath: outputPath,
    });
    const uploadMs = Date.now() - uploadStartMs;
    const totalMs = Date.now() - totalStartMs;

    console.log(
      `[${chunkId}] Timing download_ms=${dlMs} render_ms=${renderMs} upload_ms=${uploadMs} total_ms=${totalMs} ` +
        `input_mb=${(inputBytes / 1048576).toFixed(2)} output_mb=${(outputBytes / 1048576).toFixed(2)}`,
    );

    await updateChunkStatus(chunkId, {
      recipeId,
      status: "DONE",
      processedBucket,
      processedObject: destObject,
      error: FieldValue.delete(),
    });

    return {
      chunkId,
      recipeId,
      status: "DONE",
      processedBucket,
      processedObject: destObject,
    };
  } catch (err) {
    await updateChunkStatus(chunkId, {
      recipeId,
      status: "FAILED",
      error: err?.message || String(err),
    });
    throw err;
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

const app = express();
app.use(express.json({ limit: "2mb" }));

app.get("/healthz", (_req, res) => {
  res.status(200).json({ ok: true });
});

app.post("/process", async (req, res) => {
  const {
    chunkId,
    recipeId,
    rawObject,
    outputObject,
    recipe,
    videoUrl,
    startTime,
    duration,
  } = req.body || {};
  if (!chunkId || !recipeId) {
    return res.status(400).json({
      ok: false,
      error: "chunkId and recipeId are required",
    });
  }

  try {
    const result = await processChunkJob({
      chunkId,
      recipeId,
      rawObject,
      outputObject,
      recipe,
      videoUrl,
      startTime,
      duration,
    });
    return res.status(200).json({ ok: true, result });
  } catch (err) {
    console.error("[worker] process failed:", err);
    return res.status(500).json({
      ok: false,
      error: err?.message || "unknown_error",
    });
  }
});

app.post("/subtitles", async (req, res) => {
  const { videoUrl, language } = req.body || {};
  if (!videoUrl) {
    return res.status(400).json({ ok: false, error: "videoUrl is required" });
  }
  try {
    const cues = await processSubtitlesJob({ videoUrl, language });
    return res.status(200).json({
      ok: true,
      result: {
        recipeId: "subtitles",
        cues,
      },
    });
  } catch (err) {
    console.error("[worker] subtitles failed:", err);
    return res.status(500).json({
      ok: false,
      error: err?.message || "unknown_error",
    });
  }
});

app.post("/avs-voiceover", async (req, res) => {
  const { lines, voiceId, pronunciation } = req.body || {};
  if (!Array.isArray(lines) || lines.length === 0) {
    return res.status(400).json({ ok: false, error: "lines array is required" });
  }
  try {
    const result = await processVoiceoverJob({ lines, voiceId, pronunciation });
    return res.status(200).json({
      ok: true,
      result: {
        recipeId: "avs-voiceover",
        ...result,
      },
    });
  } catch (err) {
    console.error("[worker] avs-voiceover failed:", err);
    return res.status(500).json({
      ok: false,
      error: err?.message || "unknown_error",
    });
  }
});

app.post("/avs-sync", async (req, res) => {
  const { videoUrl, audioUrl, steps, stepTimings } = req.body || {};
  if (!videoUrl) {
    return res.status(400).json({ ok: false, error: "videoUrl is required" });
  }
  try {
    const result = await processSyncJob({ videoUrl, audioUrl, steps, stepTimings });
    return res.status(200).json({
      ok: true,
      result: {
        recipeId: "avs-sync",
        ...result,
      },
    });
  } catch (err) {
    console.error("[worker] avs-sync failed:", err);
    return res.status(500).json({
      ok: false,
      error: err?.message || "unknown_error",
    });
  }
});

app.post("/merge", async (req, res) => {
  const { recipeId, chunkFilenames } = req.body || {};
  if (
    !recipeId ||
    !Array.isArray(chunkFilenames) ||
    chunkFilenames.length === 0
  ) {
    return res.status(400).json({
      ok: false,
      error: "recipeId and chunkFilenames array are required",
    });
  }

  const processedBucket = must("PROCESSED_BUCKET", PROCESSED_BUCKET);
  const workDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "marvedge-gcp-merge-"),
  );
  const finalFilename = `${recipeId}.mp4`;
  const finalPath = path.join(workDir, finalFilename);
  const concatTextPath = path.join(workDir, "concat.txt");

  try {
    let concatLines = "";
    for (let i = 0; i < chunkFilenames.length; i++) {
      const chunkName = chunkFilenames[i];
      const localChunkPath = path.join(workDir, chunkName);
      await downloadRawChunkFromGcs({
        bucketName: processedBucket,
        objectName: chunkName,
        destinationPath: localChunkPath,
      });
      concatLines += `file '${chunkName}'\n`;
    }

    await fs.writeFile(concatTextPath, concatLines);

    await new Promise((resolve, reject) => {
      require("fluent-ffmpeg")()
        .input(concatTextPath)
        .inputOptions(["-f concat", "-safe 0"])
        .outputOptions("-c copy")
        .output(finalPath)
        .on("end", resolve)
        .on("error", reject)
        .run();
    });

    await uploadProcessedChunkToGcs({
      bucketName: processedBucket,
      objectName: finalFilename,
      sourcePath: finalPath,
    });

    const fileRef = storage.bucket(processedBucket).file(finalFilename);
    try {
      await fileRef.makePublic();
    } catch (e) {
      /* Ignore if UBLA is enforced */
    }

    const publicUrl = `https://storage.googleapis.com/${processedBucket}/${finalFilename}`;

    for (let i = 0; i < chunkFilenames.length; i++) {
      storage
        .bucket(processedBucket)
        .file(chunkFilenames[i])
        .delete()
        .catch(() => {});
    }

    return res.status(200).json({
      ok: true,
      result: {
        recipeId,
        mergedObject: finalFilename,
        exportedUrl: publicUrl,
      },
    });
  } catch (err) {
    console.error("[worker] merge failed:", err);
    return res
      .status(500)
      .json({ ok: false, error: err?.message || "unknown_error" });
  } finally {
    fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
});

app.listen(PORT, () => {
  console.log(`Cloud Run worker listening on :${PORT}`);
});
