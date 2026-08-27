import { describe, expect, it } from "vitest";

import {
  AUDIO_MAX_BYTES,
  detectAudioMime,
  extFromFilename,
  isAllowedAudioExtension,
  sanitizeFilename,
  validateTrimRange,
  validateUploadRequest,
} from "./validation";

describe("validateTrimRange", () => {
  it("accepts a valid range", () => {
    expect(validateTrimRange({ trimStartSec: 5, trimEndSec: 20 })).toEqual({ ok: true });
  });

  it("rejects negative starts", () => {
    expect(validateTrimRange({ trimStartSec: -1, trimEndSec: 5 })).toEqual({
      ok: false,
      error: "Trim start cannot be negative",
    });
  });

  it("rejects end <= start", () => {
    expect(validateTrimRange({ trimStartSec: 10, trimEndSec: 10 })).toEqual({
      ok: false,
      error: "Trim end must be after the trim start",
    });
  });

  it("rejects non-numbers", () => {
    expect(validateTrimRange({ trimStartSec: Number.NaN, trimEndSec: 5 } as never)).toMatchObject({
      ok: false,
    });
  });

  it("rejects a start beyond the source duration", () => {
    expect(validateTrimRange({ trimStartSec: 30, trimEndSec: 40, durationSec: 25 })).toMatchObject({
      ok: false,
    });
  });

  it("allows an end beyond the source duration (clamped at EOF by the job)", () => {
    expect(validateTrimRange({ trimStartSec: 10, trimEndSec: 999, durationSec: 25 })).toEqual({
      ok: true,
    });
  });
});

describe("sanitizeFilename", () => {
  it("strips path separators and odd characters (dots are kept)", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe(".._.._etc_passwd");
  });

  it("collapses repeated separators", () => {
    expect(sanitizeFilename("a////b")).toBe("a_b");
  });

  it("keeps a normal file name", () => {
    expect(sanitizeFilename("voiceover-final.mp3")).toBe("voiceover-final.mp3");
  });
});

describe("extFromFilename / isAllowedAudioExtension", () => {
  it("lowercases the extension", () => {
    expect(extFromFilename("Intro.WAV")).toBe("wav");
  });

  it("returns '' when there is no extension", () => {
    expect(extFromFilename("noext")).toBe("");
  });

  it("knows the allowed extensions", () => {
    expect(isAllowedAudioExtension("mp3")).toBe(true);
    expect(isAllowedAudioExtension("wav")).toBe(true);
    expect(isAllowedAudioExtension("m4a")).toBe(true);
    expect(isAllowedAudioExtension("ogg")).toBe(true);
    expect(isAllowedAudioExtension("exe")).toBe(false);
  });
});

describe("validateUploadRequest", () => {
  const base = { fileName: "track.mp3", mimeType: "audio/mpeg", size: 1024 };

  it("accepts an allowed upload", () => {
    expect(validateUploadRequest(base)).toEqual({
      ok: true,
      fileName: "track.mp3",
      ext: "mp3",
      mimeType: "audio/mpeg",
    });
  });

  it("rejects an unsupported extension", () => {
    const result = validateUploadRequest({ ...base, fileName: "virus.exe" });
    expect(result).toMatchObject({ ok: false });
  });

  it("rejects an empty file", () => {
    expect(validateUploadRequest({ ...base, size: 0 })).toMatchObject({ ok: false });
  });

  it("rejects a file over the 50MB cap", () => {
    expect(validateUploadRequest({ ...base, size: AUDIO_MAX_BYTES + 1 })).toMatchObject({
      ok: false,
    });
  });

  it("accepts exactly the cap", () => {
    expect(validateUploadRequest({ ...base, size: AUDIO_MAX_BYTES })).toMatchObject({ ok: true });
  });

  it("stores the canonical MIME derived from the extension, not the client header", () => {
    const result = validateUploadRequest({ ...base, fileName: "track.wav", mimeType: "text/html" });
    expect(result).toMatchObject({ ok: true, mimeType: "audio/wav" });
  });
});

describe("detectAudioMime", () => {
  const pad = (header: Buffer): Buffer => Buffer.concat([header, Buffer.alloc(64, 0)]);

  it("detects MP3 via ID3v2 tag", () => {
    expect(detectAudioMime(pad(Buffer.from("ID3\u0003\u0000\u0000\u0000\u0000\u0000")))).toBe(
      "audio/mpeg"
    );
  });

  it("detects MP3 via an MPEG frame sync byte", () => {
    const frame = Buffer.alloc(64);
    frame[0] = 0xff;
    frame[1] = 0xfb;
    expect(detectAudioMime(frame)).toBe("audio/mpeg");
  });

  it("detects WAV", () => {
    const wav = pad(Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WAVE")]));
    expect(detectAudioMime(wav)).toBe("audio/wav");
  });

  it("detects M4A via ftyp box", () => {
    const m4a = pad(Buffer.concat([Buffer.alloc(4), Buffer.from("ftypM4A ")])).subarray(0, 12);
    expect(detectAudioMime(m4a)).toBe("audio/mp4");
  });

  it("detects OGG", () => {
    expect(detectAudioMime(pad(Buffer.from("OggS\u0000\u0002\u0000\u0000")))).toBe("audio/ogg");
  });

  it("returns null for unknown bytes and tiny buffers", () => {
    expect(detectAudioMime(Buffer.from("PNG..."))).toBeNull();
    expect(detectAudioMime(Buffer.alloc(8))).toBeNull();
  });
});
