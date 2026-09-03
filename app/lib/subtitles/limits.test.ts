import { describe, expect, it } from "vitest";

import {
  MAX_SUBTITLE_DURATION_SECONDS,
  MAX_UPLOAD_BYTES,
  UPLOAD_VIDEO_ACCEPT,
  UPLOAD_VIDEO_EXTENSIONS,
  fileExtension,
  formatBytes,
  formatDuration,
  isVideoUploadKind,
  subtitleWorkerTimeoutMs,
  validateSubtitleDuration,
  validateVideoUpload,
} from "./limits";

const MB = 1024 * 1024;
const GB = 1024 * MB;

describe("upload container rules (PRD §6.1)", () => {
  it("accepts the PRD's four containers", () => {
    for (const ext of ["mp4", "mov", "avi", "mkv"]) {
      const result = validateVideoUpload({
        filename: `demo.${ext}`,
        contentType: "",
        size: 10 * MB,
      });
      expect(result, `.${ext} should be accepted`).toEqual({ ok: true });
    }
  });

  it("accepts webm, which the recorder itself produces", () => {
    // Not in the PRD's list, and deliberately allowed: MediaRecorder emits webm
    // and every recorded demo goes through this same path. Rejecting it would
    // break the product's primary flow.
    expect(validateVideoUpload({ filename: "recording.webm", contentType: "video/webm" })).toEqual({
      ok: true,
    });
  });

  it("rejects a container we do not support, naming the extension", () => {
    const result = validateVideoUpload({ filename: "clip.flv", contentType: "video/x-flv" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain(".flv");
      expect(result.error).toContain("MP4, MOV, AVI or MKV");
    }
  });

  it("rejects a non-video file outright", () => {
    const result = validateVideoUpload({ filename: "notes.pdf", contentType: "application/pdf" });
    expect(result.ok).toBe(false);
  });

  it("accepts a recognised extension even when the browser reports no MIME type", () => {
    // Windows very often reports "" for .mkv. An extension-only file must still
    // pass, or real videos get refused.
    expect(validateVideoUpload({ filename: "episode.mkv", contentType: "" })).toEqual({ ok: true });
  });

  it("accepts a recognised MIME type even when the file has no extension", () => {
    expect(validateVideoUpload({ filename: "movie", contentType: "video/quicktime" })).toEqual({
      ok: true,
    });
  });

  it("tolerates a MIME type carrying codec parameters", () => {
    expect(
      validateVideoUpload({ filename: "rec", contentType: "video/webm;codecs=vp9,opus" })
    ).toEqual({ ok: true });
  });

  it("is case-insensitive about the extension", () => {
    expect(validateVideoUpload({ filename: "HOLIDAY.MOV", contentType: "" })).toEqual({ ok: true });
  });

  it("offers every accepted extension in the file input's accept attribute", () => {
    for (const ext of UPLOAD_VIDEO_EXTENSIONS) {
      expect(UPLOAD_VIDEO_ACCEPT).toContain(`.${ext}`);
    }
  });
});

describe("upload size cap (PRD §6.1: 2 GB)", () => {
  it("caps at exactly 2 GB", () => {
    expect(MAX_UPLOAD_BYTES).toBe(2 * GB);
  });

  it("accepts a file at the limit", () => {
    expect(
      validateVideoUpload({ filename: "big.mp4", contentType: "video/mp4", size: MAX_UPLOAD_BYTES })
    ).toEqual({ ok: true });
  });

  it("rejects a 3 GB file, naming the actual size and the limit", () => {
    const result = validateVideoUpload({
      filename: "huge.mp4",
      contentType: "video/mp4",
      size: 3 * GB,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("3.0 GB");
      expect(result.error).toContain("2.0 GB");
    }
  });

  it("rejects an empty file rather than passing a zero-byte upload through", () => {
    const result = validateVideoUpload({
      filename: "empty.mp4",
      contentType: "video/mp4",
      size: 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("empty");
    }
  });

  it("accepts an unknown size — absent is not the same as invalid", () => {
    expect(validateVideoUpload({ filename: "clip.mp4", contentType: "video/mp4" })).toEqual({
      ok: true,
    });
    expect(
      validateVideoUpload({ filename: "clip.mp4", contentType: "video/mp4", size: null })
    ).toEqual({ ok: true });
  });

  it("checks the container before the size, so a bad file gets the useful message", () => {
    const result = validateVideoUpload({ filename: "huge.flv", contentType: "", size: 5 * GB });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain(".flv");
    }
  });
});

describe("which uploads the video rules apply to", () => {
  it("covers every kind that carries a video", () => {
    for (const kind of ["demo-source", "export-source", "webcam-source", "subtitle-source"]) {
      expect(isVideoUploadKind(kind), kind).toBe(true);
    }
  });

  it("leaves image kinds alone — a watermark PNG is not judged as a video", () => {
    for (const kind of ["watermark", "background", "generic"]) {
      expect(isVideoUploadKind(kind), kind).toBe(false);
    }
  });
});

describe("long videos (PRD §13)", () => {
  it("caps at exactly 2 hours", () => {
    expect(MAX_SUBTITLE_DURATION_SECONDS).toBe(7200);
  });

  it("accepts a video at the ceiling", () => {
    expect(validateSubtitleDuration(MAX_SUBTITLE_DURATION_SECONDS)).toEqual({ ok: true });
  });

  it("rejects a longer one, naming its actual length and the limit", () => {
    const result = validateSubtitleDuration(3 * 60 * 60);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("3h 0m");
      expect(result.error).toContain("2h 0m");
    }
  });

  it("accepts an unmeasured duration — the player may not have loaded metadata", () => {
    // Refusing to caption a video because we have not measured it yet would
    // break generation on a slow connection.
    expect(validateSubtitleDuration(0)).toEqual({ ok: true });
    expect(validateSubtitleDuration(null)).toEqual({ ok: true });
    expect(validateSubtitleDuration(undefined)).toEqual({ ok: true });
    expect(validateSubtitleDuration(Number.NaN)).toEqual({ ok: true });
  });
});

describe("worker timeout scaling", () => {
  it("leaves a short video on the existing 180s default", () => {
    // Nothing about a short demo's request may change. The floor covers
    // everything up to 8 minutes of video (60s fixed + 250ms per second).
    expect(subtitleWorkerTimeoutMs(30)).toBe(180_000);
    expect(subtitleWorkerTimeoutMs(2 * 60)).toBe(180_000);
    expect(subtitleWorkerTimeoutMs(8 * 60)).toBe(180_000);
    expect(subtitleWorkerTimeoutMs(null)).toBe(180_000);
    expect(subtitleWorkerTimeoutMs(undefined)).toBe(180_000);
  });

  it("gives a 10-minute video real headroom over the PRD's 60s target", () => {
    // PRD §7 wants a 10-minute video transcribed in under 60s. The timeout is
    // not the target — it is the point at which we stop believing the worker,
    // and it has to be several times the expected time or a slow-but-fine run
    // gets killed and reported as a failure.
    const tenMinutes = subtitleWorkerTimeoutMs(10 * 60);
    expect(tenMinutes).toBeGreaterThan(180_000);
    expect(tenMinutes).toBeGreaterThan(3 * 60_000);
  });

  it("raises the ceiling for a long video", () => {
    // A 90-minute recording must not be aborted at 180s mid-transcription.
    expect(subtitleWorkerTimeoutMs(90 * 60)).toBeGreaterThan(180_000);
  });

  it("never exceeds the 15 minutes invokeGcpSync already uses", () => {
    expect(subtitleWorkerTimeoutMs(MAX_SUBTITLE_DURATION_SECONDS)).toBeLessThanOrEqual(
      15 * 60 * 1000
    );
    expect(subtitleWorkerTimeoutMs(10 * 60 * 60)).toBe(15 * 60 * 1000);
  });

  it("grows monotonically with duration", () => {
    let previous = 0;
    for (const seconds of [0, 300, 900, 1800, 3600, 7200]) {
      const ms = subtitleWorkerTimeoutMs(seconds);
      expect(ms).toBeGreaterThanOrEqual(previous);
      previous = ms;
    }
  });
});

describe("formatting helpers", () => {
  it("renders byte counts the way a user would say them", () => {
    expect(formatBytes(5 * MB)).toBe("5.0 MB");
    expect(formatBytes(250 * MB)).toBe("250 MB");
    expect(formatBytes(2 * GB)).toBe("2.0 GB");
    expect(formatBytes(-1)).toBe("0 MB");
  });

  it("renders durations the way a user would say them", () => {
    expect(formatDuration(45)).toBe("45s");
    expect(formatDuration(9 * 60 + 30)).toBe("9m 30s");
    expect(formatDuration(2 * 3600 + 14 * 60)).toBe("2h 14m");
    expect(formatDuration(0)).toBe("0s");
  });

  it("extracts extensions, and nothing where there is none", () => {
    expect(fileExtension("a.b.MP4")).toBe("mp4");
    expect(fileExtension("noextension")).toBe("");
    expect(fileExtension(".gitignore")).toBe(""); // a dotfile is not an extension
    expect(fileExtension("trailing.")).toBe("");
  });
});
