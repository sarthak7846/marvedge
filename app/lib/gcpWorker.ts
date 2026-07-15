export type GcpWorkerPayload = {
  chunkId?: string;
  recipeId: string;
  rawObject?: string;
  outputObject?: string;
  videoUrl?: string;
  recipe?: Record<string, unknown>;
  startTime?: number;
  duration?: number;
  chunkFilenames?: string[];
  // AVS voiceover (`/avs-voiceover`).
  lines?: Array<{ stepId: string; text: string }>;
  voiceId?: string;
  pronunciation?: Array<{ term: string; phonetic: string }>;
  // AVS time-alignment (`/avs-sync`).
  audioUrl?: string;
  steps?: Array<{ id: string; index?: number; startTime: number; endTime: number }>;
  stepTimings?: Array<{ stepId: string; start: number; end: number }>;
};

export type GcpWorkerResponse = {
  ok: boolean;
  result?: {
    chunkId?: string;
    recipeId: string;
    status?: string;
    processedBucket?: string;
    processedObject?: string;
    mergedObject?: string;
    exportedUrl?: string;
    // AVS voiceover (`/avs-voiceover`).
    audioUrl?: string;
    duration?: number;
    stepTimings?: Array<{ stepId: string; start: number; end: number }>;
    // AVS time-alignment (`/avs-sync`).
    alignedVideoUrl?: string;
  };
  error?: string;
};

function getGcpWorkerUrl() {
  return (process.env.GCP_VIDEO_WORKER_URL || "").trim();
}

function normalizeWorkerBaseUrl(rawUrl: string) {
  let url = rawUrl.trim();
  if (!url) {
    return "";
  }
  url = url.replace(/\/+$/, "");
  // Accept env values ending with a known endpoint (/process, /subtitles,
  // /avs-voiceover, /avs-sync) so we always POST against the worker's base URL.
  url = url.replace(/\/(process|subtitles|avs-voiceover|avs-sync)$/i, "");
  return url;
}

export async function invokeGcpWorker(
  payload: GcpWorkerPayload,
  endpoint = "/process",
  options: { timeoutMs?: number } = {}
) {
  const rawUrl = getGcpWorkerUrl();
  if (!rawUrl) {
    throw new Error("GCP_VIDEO_WORKER_URL is not configured");
  }
  const baseUrl = normalizeWorkerBaseUrl(rawUrl);
  if (!baseUrl) {
    throw new Error("GCP_VIDEO_WORKER_URL is invalid");
  }
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = `${baseUrl}${cleanEndpoint}`;

  const controller = new AbortController();
  // Callers with a heavier round-trip (e.g. ffmpeg alignment) can raise the
  // per-request timeout; otherwise fall back to the shared env default.
  const envTimeoutMs = Number.parseInt(process.env.GCP_VIDEO_WORKER_TIMEOUT_MS || "180000", 10);
  const defaultTimeoutMs = Number.isFinite(envTimeoutMs) ? envTimeoutMs : 180000;
  const timeoutMs =
    typeof options.timeoutMs === "number" && Number.isFinite(options.timeoutMs)
      ? options.timeoutMs
      : defaultTimeoutMs;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let attempt = 0;
  const maxAttempts = 3;

  try {
    while (attempt < maxAttempts) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
          cache: "no-store",
        });

        const body = (await response.json().catch(() => ({}))) as GcpWorkerResponse;

        if (!response.ok || !body.ok) {
          // If the Cloud Run instance rejects the burst with 503 or 429, we trigger a retry
          if ([429, 502, 503, 504].includes(response.status) && attempt < maxAttempts - 1) {
            const backoffMs = 1500 * Math.pow(2, attempt);
            console.warn(
              `GCP worker scale-up delay (${response.status}). Retrying in ${backoffMs}ms...`
            );
            await new Promise((res) => setTimeout(res, backoffMs));
            attempt++;
            continue;
          }
          throw new Error(body.error || `GCP worker failed (${response.status}) at ${url}`);
        }

        return body;
      } catch (e: unknown) {
        if (attempt >= maxAttempts - 1) {
          throw e; // Max attempts reached
        }

        const errorMessage = e instanceof Error ? e.message : String(e);
        // Throw fast on deterministic non-network exceptions (like aborts)
        if (errorMessage.includes("aborted")) {
          throw e;
        }

        // Network error like socket hang up
        const backoffMs = 1500 * Math.pow(2, attempt);
        console.warn(`GCP worker connection error. Retrying in ${backoffMs}ms...`);
        await new Promise((res) => setTimeout(res, backoffMs));
        attempt++;
      }
    }
  } finally {
    clearTimeout(timer);
  }

  throw new Error("GCP worker failed after multiple retries");
}

export type GcpSubtitlesPayload = {
  videoUrl: string;
  language?: string;
};

export async function invokeGcpSubtitles(payload: GcpSubtitlesPayload) {
  const body = await invokeGcpWorker(
    {
      recipeId: "subtitles",
      videoUrl: payload.videoUrl,
      recipe: { language: payload.language || "multi" },
    },
    "/subtitles"
  );

  const cues = (
    body.result as { cues?: Array<{ start: number; end: number; text: string }> } | undefined
  )?.cues;
  return Array.isArray(cues) ? cues : [];
}

export type GcpVoiceoverPayload = {
  lines: Array<{ stepId: string; text: string }>;
  voiceId: string;
  pronunciation?: Array<{ term: string; phonetic: string }>;
};

export type GcpVoiceoverResult = {
  audioUrl: string;
  duration: number;
  stepTimings: Array<{ stepId: string; start: number; end: number }>;
};

/**
 * Trigger the Cloud Run worker's `/avs-voiceover` endpoint (Deepgram Aura TTS →
 * one continuous MP3). The Deepgram key lives in the worker, so the Next app only
 * needs GCP_VIDEO_WORKER_URL. Mirrors `invokeGcpSubtitles`.
 */
export async function invokeGcpVoiceover(
  payload: GcpVoiceoverPayload
): Promise<GcpVoiceoverResult> {
  const body = await invokeGcpWorker(
    {
      recipeId: "avs-voiceover",
      lines: payload.lines,
      voiceId: payload.voiceId,
      pronunciation: payload.pronunciation,
    },
    "/avs-voiceover"
  );

  const result = body.result;
  const audioUrl = typeof result?.audioUrl === "string" ? result.audioUrl : "";
  if (!audioUrl) {
    throw new Error("Voiceover worker returned no audio URL");
  }
  const duration = typeof result?.duration === "number" ? result.duration : 0;
  const stepTimings = Array.isArray(result?.stepTimings) ? result.stepTimings : [];
  return { audioUrl, duration, stepTimings };
}

export type GcpSyncPayload = {
  videoUrl: string;
  audioUrl: string;
  steps: Array<{ id: string; index?: number; startTime: number; endTime: number }>;
  stepTimings: Array<{ stepId: string; start: number; end: number }>;
};

export type GcpSyncResult = {
  alignedVideoUrl: string;
  duration: number;
};

// ffmpeg alignment (download → per-step re-encode → concat → mux) is heavier
// than a normal chunk render, so give the worker round-trip generous headroom.
const AVS_SYNC_TIMEOUT_MS = 15 * 60 * 1000;

/**
 * Trigger the Cloud Run worker's `/avs-sync` endpoint: freeze-frame / silence
 * time-alignment of the continuous voiceover to the video, producing one
 * aligned MP4 the normal export can then process. Mirrors `invokeGcpVoiceover`.
 */
export async function invokeGcpSync(payload: GcpSyncPayload): Promise<GcpSyncResult> {
  const body = await invokeGcpWorker(
    {
      recipeId: "avs-sync",
      videoUrl: payload.videoUrl,
      audioUrl: payload.audioUrl,
      steps: payload.steps,
      stepTimings: payload.stepTimings,
    },
    "/avs-sync",
    { timeoutMs: AVS_SYNC_TIMEOUT_MS }
  );

  const result = body.result;
  const alignedVideoUrl = typeof result?.alignedVideoUrl === "string" ? result.alignedVideoUrl : "";
  if (!alignedVideoUrl) {
    throw new Error("Sync worker returned no aligned video URL");
  }
  const duration = typeof result?.duration === "number" ? result.duration : 0;
  return { alignedVideoUrl, duration };
}
