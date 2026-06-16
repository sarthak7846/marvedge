import { ZoomEffect } from "../types/editor/zoom-effect";

type Overlay =
  | { type: "blur" | "rect"; x: number; y: number; w: number; h: number }
  | { type: "arrow"; x: number; y: number; x2: number; y2: number }
  | { type: "text"; x: number; y: number; text: string };

type FFmpegModule = typeof import("@ffmpeg/ffmpeg");
type FFmpegInstance = ReturnType<FFmpegModule["createFFmpeg"]>;

// Convert "HH:MM:SS[.mmm]" or a number into a float count of seconds.
function toSeconds(t: string | number): number {
  if (typeof t === "number") {
    return t;
  }
  if (t.includes(":")) {
    // HH:MM:SS[.mmm]
    const parts = t.split(":").map(Number);
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    } else {
      return Number(t);
    }
  }
  return parseFloat(t);
}

// Get file size in the ffmpeg FS (returns 0 if file doesn't exist).
function getFFmpegFileSize(ffmpeg: FFmpegInstance, name: string): number {
  try {
    const d = ffmpeg.FS("readFile", name);
    return d.length;
  } catch {
    return 0;
  }
}

// Check that a file exists and has a reasonable size in the ffmpeg FS.
function ffmpegFileValid(ffmpeg: FFmpegInstance, name: string, minBytes = 1000): boolean {
  return getFFmpegFileSize(ffmpeg, name) >= minBytes;
}

// Clean up intermediate files (ignore errors).
function cleanupFFmpegFiles(ffmpeg: FFmpegInstance, ...names: string[]): void {
  for (const n of names) {
    try {
      ffmpeg.FS("unlink", n);
    } catch {
      /* ignore */
    }
  }
}

// Strategy 1: Stream-copy (fast, no quality loss). Works when the recording has
// proper audio. May fail with synthetic silent audio (mic off) because webm/opus
// timestamps don't split cleanly with -c copy. Returns true on success.
async function trimByStreamCopy(
  ffmpeg: FFmpegInstance,
  inputName: string,
  outputName: string,
  startSec: number,
  endSec: number,
  inputSize: number
): Promise<boolean> {
  try {
    const parts: string[] = [];

    if (startSec > 0) {
      const part1Name = "part1.webm";
      try {
        await ffmpeg.run(
          "-i",
          inputName,
          "-ss",
          "0",
          "-to",
          String(startSec),
          "-c",
          "copy",
          part1Name
        );
        if (ffmpegFileValid(ffmpeg, part1Name)) {
          parts.push(part1Name);
        }
      } catch {
        console.warn("Stream-copy: Part 1 extraction failed");
      }
    }

    const part2Name = "part2.webm";
    try {
      await ffmpeg.run("-i", inputName, "-ss", String(endSec), "-c", "copy", part2Name);
      if (ffmpegFileValid(ffmpeg, part2Name)) {
        parts.push(part2Name);
      }
    } catch {
      console.warn("Stream-copy: Part 2 extraction failed");
    }

    if (parts.length > 0) {
      const concatList = parts.map((p) => `file '${p}'`).join("\n");
      ffmpeg.FS("writeFile", "concat.txt", new TextEncoder().encode(concatList));

      await ffmpeg.run("-f", "concat", "-safe", "0", "-i", "concat.txt", "-c", "copy", outputName);

      const outSize = getFFmpegFileSize(ffmpeg, outputName);
      // Trim should ALWAYS produce a smaller file — if output is bigger
      // than input, the stream-copy produced corrupt/inflated output
      if (outSize >= 1000 && outSize < inputSize) {
        console.log("Trim succeeded with stream-copy", { inputSize, outSize });
        return true;
      } else if (outSize > 0) {
        console.warn("Stream-copy output looks wrong (size mismatch)", {
          inputSize,
          outSize,
        });
      }
    }
  } catch (err) {
    console.warn("Stream-copy trim failed, will try re-encode fallback:", err);
  }
  return false;
}

// Strategy 2: Re-encode fallback (handles mic-off / silent audio). Re-encodes to
// fix audio timestamps using libvpx for video and libopus for audio.
async function trimByReencode(
  ffmpeg: FFmpegInstance,
  inputName: string,
  outputName: string,
  startSec: number,
  endSec: number
): Promise<void> {
  console.log("Falling back to re-encode trim...");

  // Clean up any leftover files from strategy 1
  cleanupFFmpegFiles(ffmpeg, "part1.webm", "part2.webm", "concat.txt", outputName);

  const parts: string[] = [];

  if (startSec > 0) {
    const part1Name = "re_part1.webm";
    try {
      await ffmpeg.run(
        "-i",
        inputName,
        "-ss",
        "0",
        "-to",
        String(startSec),
        "-c:v",
        "libvpx",
        "-crf",
        "10",
        "-b:v",
        "0",
        "-c:a",
        "libopus",
        part1Name
      );
      if (ffmpegFileValid(ffmpeg, part1Name)) {
        parts.push(part1Name);
      }
    } catch {
      console.warn("Re-encode: Part 1 extraction failed");
    }
  }

  const part2Name = "re_part2.webm";
  try {
    await ffmpeg.run(
      "-i",
      inputName,
      "-ss",
      String(endSec),
      "-c:v",
      "libvpx",
      "-crf",
      "10",
      "-b:v",
      "0",
      "-c:a",
      "libopus",
      part2Name
    );
    if (ffmpegFileValid(ffmpeg, part2Name)) {
      parts.push(part2Name);
    }
  } catch {
    console.warn("Re-encode: Part 2 extraction failed");
  }

  if (parts.length === 0) {
    throw new Error("Failed to extract any video segments for trimming");
  }

  const concatList = parts.map((p) => `file '${p}'`).join("\n");
  ffmpeg.FS("writeFile", "re_concat.txt", new TextEncoder().encode(concatList));

  try {
    await ffmpeg.run("-f", "concat", "-safe", "0", "-i", "re_concat.txt", "-c", "copy", outputName);
  } catch (err) {
    console.error("Re-encode concat failed:", err);
    throw new Error("Failed to trim and concatenate video segments");
  }

  if (!ffmpegFileValid(ffmpeg, outputName)) {
    throw new Error("Re-encode trim produced no valid output");
  }

  console.log("Trim succeeded with re-encode fallback");
}

export const videoTrimmer = async (inputBlob: Blob, start: string, end: string): Promise<Blob> => {
  const { createFFmpeg } = await import("@ffmpeg/ffmpeg");
  const ffmpeg = createFFmpeg({
    log: true,
    corePath: "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.10.0/dist/ffmpeg-core.js",
  });
  if (!ffmpeg.isLoaded()) {
    await ffmpeg.load();
  }

  const inputName = "input.webm";
  const outputName = "output.webm";

  const inputData = new Uint8Array(await inputBlob.arrayBuffer());
  const inputSize = inputData.length;
  ffmpeg.FS("writeFile", inputName, inputData);

  const startSec = toSeconds(start);
  const endSec = toSeconds(end);

  const streamCopySuccess = await trimByStreamCopy(
    ffmpeg,
    inputName,
    outputName,
    startSec,
    endSec,
    inputSize
  );

  if (!streamCopySuccess) {
    await trimByReencode(ffmpeg, inputName, outputName, startSec, endSec);
  }

  try {
    const data = ffmpeg.FS("readFile", outputName);
    return new Blob([data.slice(0).buffer], { type: "video/webm" });
  } catch (e) {
    console.error("FFmpeg output read error", e);
    throw new Error("Output file not found");
  }
};

export const videoToMP4 = async (inputBlob: Blob): Promise<Blob> => {
  const { createFFmpeg } = await import("@ffmpeg/ffmpeg");
  const ffmpeg = createFFmpeg({
    log: true,
    corePath: "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.10.0/dist/ffmpeg-core.js",
  });
  if (!ffmpeg.isLoaded()) {
    await ffmpeg.load();
  }

  const inputName = "input.webm";
  const outputName = "output.mp4";
  ffmpeg.FS("writeFile", inputName, new Uint8Array(await inputBlob.arrayBuffer()));
  await ffmpeg.run(
    "-i",
    inputName,
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-c:a",
    "aac",
    outputName
  );

  const data = ffmpeg.FS("readFile", outputName);
  return new Blob([data.slice(0).buffer], { type: "video/mp4" });
};

export const videoToThumbnail = async (inputBlob: Blob): Promise<Blob> => {
  const { createFFmpeg } = await import("@ffmpeg/ffmpeg");
  const ffmpeg = createFFmpeg({
    log: true,
    corePath: "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.10.0/dist/ffmpeg-core.js",
  });
  if (!ffmpeg.isLoaded()) {
    await ffmpeg.load();
  }

  const inputName = "input.webm";
  const outputName = "thumbnail.jpg";
  ffmpeg.FS("writeFile", inputName, new Uint8Array(await inputBlob.arrayBuffer()));
  await ffmpeg.run("-i", inputName, "-ss", "00:00:01.000", "-vframes", "1", outputName);

  const data = ffmpeg.FS("readFile", outputName);
  return new Blob([data.slice(0).buffer], { type: "image/jpeg" });
};

export const videoToMP4WithOverlays = async (
  inputBlob: Blob,
  overlays: Overlay[]
): Promise<Blob> => {
  const { createFFmpeg } = await import("@ffmpeg/ffmpeg");
  const ffmpeg = createFFmpeg({
    log: true,
    corePath: "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.10.0/dist/ffmpeg-core.js",
  });
  if (!ffmpeg.isLoaded()) {
    await ffmpeg.load();
  }

  const inputName = "input.webm";
  const outputName = "output_overlay.mp4";
  ffmpeg.FS("writeFile", inputName, new Uint8Array(await inputBlob.arrayBuffer()));

  const vf = generateFFmpegFilters(overlays);

  await ffmpeg.run(
    "-i",
    inputName,
    "-vf",
    vf,
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-c:a",
    "aac",
    outputName
  );

  const data = ffmpeg.FS("readFile", outputName);
  return new Blob([data.slice(0).buffer], { type: "video/mp4" });
};

export const videoWithZoomEffects = async (
  inputBlob: Blob,
  zoomEffects: ZoomEffect[]
): Promise<Blob> => {
  // Use the enhanced zoom processor
  const { createEnhancedZoomProcessor } = await import("./enhancedZoomProcessor");
  return await createEnhancedZoomProcessor(inputBlob, zoomEffects);
};

function generateFFmpegFilters(overlays: Overlay[]): string {
  return overlays
    .map((o) => {
      switch (o.type) {
        case "blur":
          return `[0:v]crop=w=${o.w}:h=${o.h}:x=${o.x}:y=${o.y},boxblur=10[blurred];[0:v][blurred]overlay=${o.x}:${o.y}`;
        case "rect":
          return `drawbox=x=${o.x}:y=${o.y}:w=${o.w}:h=${o.h}:color=red@0.6:t=2`;
        case "arrow":
          return `drawbox=x=${o.x}:y=${o.y}:w=2:h=2:color=yellow@1.0:t=fill`;
        case "text":
          return `drawtext=text='${o.text}':x=${o.x}:y=${o.y}:fontsize=20:fontcolor=white`;
      }
    })
    .join(",");
}

export const videoToMP3 = async (inputBlob: Blob): Promise<Blob> => {
  const { createFFmpeg } = await import("@ffmpeg/ffmpeg");
  const ffmpeg = createFFmpeg({
    log: true,
    corePath: "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.10.0/dist/ffmpeg-core.js",
  });
  if (!ffmpeg.isLoaded()) {
    await ffmpeg.load();
  }

  const inputName = "input.webm";
  const outputName = "output.mp3";
  ffmpeg.FS("writeFile", inputName, new Uint8Array(await inputBlob.arrayBuffer()));
  await ffmpeg.run("-i", inputName, "-vn", "-ar", "44100", "-ac", "2", "-b:a", "192k", outputName);

  const data = ffmpeg.FS("readFile", outputName);
  return new Blob([data.slice(0).buffer], { type: "audio/mp3" });
};

/// when i try to trim out a part in a video + audio is toggled on , it successfully happens
/// but when i try to trim out a part in a video + audio is toggled off , it doesn't happen
///
