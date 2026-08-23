import { describe, expect, it } from "vitest";

import {
  SUBTITLE_FORMATS,
  SUBTITLE_FORMAT_MIME,
  cuesToSrt,
  cuesToTxt,
  cuesToVtt,
  formatSrtTimestamp,
  formatVttTimestamp,
  isSubtitleFormat,
  parseSrt,
  parseVtt,
  serializeCues,
  subtitleFileName,
} from "./formats";
import type { SubtitleCue } from "./types";

const CUES: SubtitleCue[] = [
  { start: 0, end: 1.5, text: "Hello" },
  { start: 1.5, end: 3, text: "there" },
  { start: 3661.5, end: 3663, text: "an hour later" },
];

describe("timestamp formatting", () => {
  it("formats WebVTT timestamps as HH:MM:SS.mmm", () => {
    expect(formatVttTimestamp(0)).toBe("00:00:00.000");
    expect(formatVttTimestamp(1.5)).toBe("00:00:01.500");
    expect(formatVttTimestamp(3661.5)).toBe("01:01:01.500");
  });

  it("formats SubRip timestamps as HH:MM:SS,mmm", () => {
    expect(formatSrtTimestamp(0)).toBe("00:00:00,000");
    expect(formatSrtTimestamp(1.5)).toBe("00:00:01,500");
    expect(formatSrtTimestamp(3661.5)).toBe("01:01:01,500");
  });

  it("differs from VTT in exactly the decimal separator", () => {
    const seconds = 12.345;
    expect(formatSrtTimestamp(seconds)).toBe(formatVttTimestamp(seconds).replace(".", ","));
  });

  it("clamps a negative or non-finite time to zero", () => {
    expect(formatVttTimestamp(-5)).toBe("00:00:00.000");
    expect(formatSrtTimestamp(Number.NaN)).toBe("00:00:00,000");
  });
});

describe("cuesToVtt", () => {
  it("produces a valid WebVTT document", () => {
    const vtt = cuesToVtt(CUES);
    expect(vtt.startsWith("WEBVTT\n\n")).toBe(true);
    expect(vtt).toContain("00:00:00.000 --> 00:00:01.500\nHello");
    expect(vtt).toContain("00:00:01.500 --> 00:00:03.000\nthere");
  });

  it("numbers the cues from one", () => {
    expect(cuesToVtt(CUES)).toContain("1\n00:00:00.000");
    expect(cuesToVtt(CUES)).toContain("2\n00:00:01.500");
  });

  it("emits a header-only document for an empty track", () => {
    expect(cuesToVtt([])).toBe("WEBVTT\n");
  });
});

describe("cuesToSrt", () => {
  it("produces a valid SubRip document", () => {
    const srt = cuesToSrt(CUES);
    expect(srt.startsWith("1\n00:00:00,000 --> 00:00:01,500\nHello")).toBe(true);
    expect(srt).toContain("2\n00:00:01,500 --> 00:00:03,000\nthere");
  });

  it("has no WEBVTT header", () => {
    expect(cuesToSrt(CUES)).not.toContain("WEBVTT");
  });

  it("is empty for an empty track", () => {
    expect(cuesToSrt([])).toBe("");
  });
});

describe("cuesToTxt", () => {
  it("writes one cue per line with no timings", () => {
    expect(cuesToTxt(CUES)).toBe("Hello\nthere\nan hour later\n");
  });

  it("is empty for an empty track", () => {
    expect(cuesToTxt([])).toBe("");
  });
});

describe("round trips", () => {
  it("round-trips cuesToSrt -> parseSrt", () => {
    const parsed = parseSrt(cuesToSrt(CUES));
    expect(parsed).toHaveLength(CUES.length);
    parsed.forEach((cue, i) => {
      expect(cue.text).toBe(CUES[i].text);
      expect(cue.start).toBeCloseTo(CUES[i].start, 3);
      expect(cue.end).toBeCloseTo(CUES[i].end, 3);
    });
  });

  it("round-trips cuesToVtt -> parseVtt", () => {
    const parsed = parseVtt(cuesToVtt(CUES));
    expect(parsed).toHaveLength(CUES.length);
    parsed.forEach((cue, i) => {
      expect(cue.text).toBe(CUES[i].text);
      expect(cue.start).toBeCloseTo(CUES[i].start, 3);
      expect(cue.end).toBeCloseTo(CUES[i].end, 3);
    });
  });

  it("round-trips multi-line cue text", () => {
    const multiline: SubtitleCue[] = [{ start: 0, end: 2, text: "first line\nsecond line" }];
    expect(parseSrt(cuesToSrt(multiline))).toEqual(multiline);
    expect(parseVtt(cuesToVtt(multiline))).toEqual(multiline);
  });

  it("round-trips an empty track", () => {
    expect(parseSrt(cuesToSrt([]))).toEqual([]);
    expect(parseVtt(cuesToVtt([]))).toEqual([]);
  });
});

describe("parsing files from elsewhere", () => {
  it("accepts CRLF line endings and a BOM", () => {
    const srt = "\uFEFF1\r\n00:00:01,000 --> 00:00:02,000\r\nHello\r\n";
    expect(parseSrt(srt)).toEqual([{ start: 1, end: 2, text: "Hello" }]);
  });

  it("accepts VTT cue settings after the end timestamp", () => {
    const vtt = "WEBVTT\n\n00:00:01.000 --> 00:00:02.000 align:middle line:90%\nHello\n";
    expect(parseVtt(vtt)).toEqual([{ start: 1, end: 2, text: "Hello" }]);
  });

  it("accepts a named cue identifier instead of a sequence number", () => {
    const vtt = "WEBVTT\n\nintro\n00:00:01.000 --> 00:00:02.000\nHello\n";
    expect(parseVtt(vtt)).toEqual([{ start: 1, end: 2, text: "Hello" }]);
  });

  it("accepts the two-part MM:SS.mmm timestamps WebVTT allows", () => {
    const vtt = "WEBVTT\n\n01:30.500 --> 01:32.000\nHello\n";
    const parsed = parseVtt(vtt);
    expect(parsed[0].start).toBeCloseTo(90.5, 3);
    expect(parsed[0].end).toBeCloseTo(92, 3);
  });

  it("skips blocks with no timing line or no text rather than failing", () => {
    const vtt = [
      "WEBVTT",
      "",
      "NOTE this is a comment block",
      "",
      "1",
      "00:00:01.000 --> 00:00:02.000",
      "Hello",
      "",
      "2",
      "00:00:03.000 --> 00:00:04.000",
      "",
      "3",
      "00:00:05.000 --> 00:00:06.000",
      "Goodbye",
      "",
    ].join("\n");
    expect(parseVtt(vtt).map((c) => c.text)).toEqual(["Hello", "Goodbye"]);
  });

  it("returns an empty list for junk input", () => {
    expect(parseSrt("")).toEqual([]);
    expect(parseSrt("not a subtitle file at all")).toEqual([]);
  });
});

describe("serializeCues", () => {
  it("dispatches to the serializer for each format", () => {
    expect(serializeCues(CUES, "srt")).toBe(cuesToSrt(CUES));
    expect(serializeCues(CUES, "vtt")).toBe(cuesToVtt(CUES));
    expect(serializeCues(CUES, "txt")).toBe(cuesToTxt(CUES));
  });

  it("covers every format SUBTITLE_FORMATS advertises", () => {
    for (const format of SUBTITLE_FORMATS) {
      expect(typeof serializeCues(CUES, format)).toBe("string");
      expect(SUBTITLE_FORMAT_MIME[format]).toBeTruthy();
    }
  });
});

describe("isSubtitleFormat", () => {
  it("accepts the three formats and nothing else", () => {
    expect(isSubtitleFormat("srt")).toBe(true);
    expect(isSubtitleFormat("vtt")).toBe(true);
    expect(isSubtitleFormat("txt")).toBe(true);
    expect(isSubtitleFormat("ass")).toBe(false);
    expect(isSubtitleFormat("SRT")).toBe(false);
    expect(isSubtitleFormat(undefined)).toBe(false);
    expect(isSubtitleFormat(1)).toBe(false);
  });
});

describe("SUBTITLE_FORMAT_MIME", () => {
  it("serves VTT as text/vtt, which <track> requires", () => {
    expect(SUBTITLE_FORMAT_MIME.vtt).toBe("text/vtt");
  });

  it("serves SRT as the registered SubRip type", () => {
    expect(SUBTITLE_FORMAT_MIME.srt).toBe("application/x-subrip");
  });

  it("carries no charset — callers append their own", () => {
    for (const format of SUBTITLE_FORMATS) {
      expect(SUBTITLE_FORMAT_MIME[format]).not.toContain("charset");
    }
  });
});

describe("subtitleFileName", () => {
  it("joins a slugged title and the language code", () => {
    expect(subtitleFileName("My Product Demo", "en", "srt")).toBe("my-product-demo-en.srt");
    expect(subtitleFileName("My Product Demo", "hi", "vtt")).toBe("my-product-demo-hi.vtt");
  });

  it("omits the language for an auto-detected track", () => {
    expect(subtitleFileName("My Demo", "multi", "txt")).toBe("my-demo.txt");
    expect(subtitleFileName("My Demo", null, "txt")).toBe("my-demo.txt");
  });

  it("falls back to a generic name when the title slugs to nothing", () => {
    expect(subtitleFileName("", "en", "srt")).toBe("subtitles-en.srt");
    expect(subtitleFileName("🎬🎬", "en", "srt")).toBe("subtitles-en.srt");
    expect(subtitleFileName(undefined, undefined, "vtt")).toBe("subtitles.vtt");
  });

  it("strips everything that could break a Content-Disposition header", () => {
    const name = subtitleFileName('../../etc/pa"sswd\r\nX: y', "en", "srt");
    expect(name).toBe("etc-pa-sswd-x-y-en.srt");
    expect(name).not.toMatch(/["\/\r\n]/);
  });

  it("bounds the length of a very long title", () => {
    const name = subtitleFileName("a".repeat(500), "en", "srt");
    expect(name.length).toBeLessThanOrEqual(70);
  });

  it("never leaves a trailing hyphen before the language or the extension", () => {
    expect(subtitleFileName("Demo — ", "en", "srt")).toBe("demo-en.srt");
    expect(subtitleFileName("Demo!!!", "multi", "srt")).toBe("demo.srt");
  });
});
