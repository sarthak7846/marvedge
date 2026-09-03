import { describe, expect, it } from "vitest";

import {
  AUTO_LEVEL,
  HLS_PREFIX,
  hasQualityChoice,
  hlsPrefixForDemo,
  isPlayablePlaylistUri,
  manifestObject,
  masterPlaylistObject,
  pickMediaUrl,
  qualityLabel,
  sortQualityLevels,
} from "./hls";

describe("object layout", () => {
  it("puts every rendition for a demo under one prefix", () => {
    expect(hlsPrefixForDemo("abc123")).toBe("hls/abc123/");
    expect(masterPlaylistObject("abc123")).toBe("hls/abc123/master.m3u8");
    expect(manifestObject("abc123")).toBe("hls/abc123/manifest.json");
    expect(masterPlaylistObject("abc123").startsWith(HLS_PREFIX)).toBe(true);
  });

  it("refuses an id that would escape the prefix", () => {
    // These become S3 object keys. A `..` segment or a slash is the difference
    // between writing under hls/<demo>/ and writing anywhere in the bucket.
    expect(() => hlsPrefixForDemo("../../etc")).toThrow();
    expect(() => hlsPrefixForDemo("a/b")).toThrow();
    expect(() => hlsPrefixForDemo("")).toThrow();
    expect(() => hlsPrefixForDemo("has space")).toThrow();
    expect(() => hlsPrefixForDemo("a".repeat(65))).toThrow();
  });

  it("accepts the id shapes Demo actually uses", () => {
    expect(hlsPrefixForDemo("550e8400-e29b-41d4-a716-446655440000")).toBe(
      "hls/550e8400-e29b-41d4-a716-446655440000/"
    );
    expect(hlsPrefixForDemo("clx1a2b3c0000xyz")).toBe("hls/clx1a2b3c0000xyz/");
  });
});

describe("isPlayablePlaylistUri", () => {
  it("accepts the two schemes the packager writes", () => {
    expect(isPlayablePlaylistUri("r2://processed/hls/abc/master.m3u8")).toBe(true);
    expect(isPlayablePlaylistUri("https://cdn.example.com/hls/abc/master.m3u8")).toBe(true);
  });

  it("accepts a presigned playlist, whose signature is in the query", () => {
    expect(
      isPlayablePlaylistUri(
        "https://cdn.example.com/hls/abc/master.m3u8?X-Amz-Signature=deadbeef&X-Amz-Expires=900"
      )
    ).toBe(true);
  });

  it("rejects anything that is not a playlist", () => {
    expect(isPlayablePlaylistUri("https://cdn.example.com/export.mp4")).toBe(false);
    expect(isPlayablePlaylistUri("r2://processed/hls/abc/init.mp4")).toBe(false);
  });

  it("rejects a scheme that must never reach a media element", () => {
    // The value comes back out of the database and is rendered into a public
    // page: a restored backup or a hand-edited row is the threat, not a user.
    expect(isPlayablePlaylistUri("javascript:alert(1)//master.m3u8")).toBe(false);
    expect(isPlayablePlaylistUri("data:text/plain,master.m3u8")).toBe(false);
    // http would be blocked as mixed content on the https share page anyway.
    expect(isPlayablePlaylistUri("http://cdn.example.com/master.m3u8")).toBe(false);
  });

  it("rejects unusable input", () => {
    expect(isPlayablePlaylistUri("")).toBe(false);
    expect(isPlayablePlaylistUri(null)).toBe(false);
    expect(isPlayablePlaylistUri(undefined)).toBe(false);
    expect(isPlayablePlaylistUri(42)).toBe(false);
  });
});

describe("pickMediaUrl", () => {
  const MP4 = "https://cdn.example.com/export.mp4";
  const PLAYLIST = "https://cdn.example.com/hls/abc/master.m3u8";

  it("falls back to the MP4 when there is no playlist — which is every demo today", () => {
    expect(pickMediaUrl({ fallbackUrl: MP4 })).toBe(MP4);
    expect(pickMediaUrl({ fallbackUrl: MP4, hlsUrl: null })).toBe(MP4);
    expect(pickMediaUrl({ fallbackUrl: MP4, hlsUrl: "" })).toBe(MP4);
  });

  it("prefers a packaged playlist when there is one", () => {
    expect(pickMediaUrl({ fallbackUrl: MP4, hlsUrl: PLAYLIST })).toBe(PLAYLIST);
  });

  it("falls back rather than breaking when the stored playlist is junk", () => {
    // A half-failed packaging run must cost the viewer nothing.
    expect(pickMediaUrl({ fallbackUrl: MP4, hlsUrl: "not a url" })).toBe(MP4);
    expect(pickMediaUrl({ fallbackUrl: MP4, hlsUrl: "https://cdn.example.com/oops.mp4" })).toBe(
      MP4
    );
  });

  it("emits nothing at all when the media is gated", () => {
    // Returning the MP4 here would put the ungated URL in the page source, which
    // is the entire thing signed media exists to prevent.
    expect(pickMediaUrl({ fallbackUrl: MP4, gated: true })).toBe("");
    expect(pickMediaUrl({ fallbackUrl: MP4, hlsUrl: PLAYLIST, gated: true })).toBe("");
  });
});

describe("the quality menu", () => {
  it("labels a rung by height", () => {
    expect(qualityLabel(1080)).toBe("1080p");
    expect(qualityLabel(480)).toBe("480p");
  });

  it("labels an unusable height as Auto rather than NaNp", () => {
    expect(qualityLabel(0)).toBe("Auto");
    expect(qualityLabel(Number.NaN)).toBe("Auto");
    expect(qualityLabel(-1)).toBe("Auto");
  });

  it("orders highest quality first", () => {
    const levels = [
      { index: 0, height: 480, bitrate: 1_200_000 },
      { index: 2, height: 1080, bitrate: 5_000_000 },
      { index: 1, height: 720, bitrate: 2_800_000 },
    ];
    expect(sortQualityLevels(levels).map((level) => level.height)).toEqual([1080, 720, 480]);
  });

  it("breaks a tie on bitrate so the order is stable", () => {
    const levels = [
      { index: 0, height: 720, bitrate: 2_000_000 },
      { index: 1, height: 720, bitrate: 3_000_000 },
    ];
    expect(sortQualityLevels(levels).map((level) => level.index)).toEqual([1, 0]);
  });

  it("does not mutate its input", () => {
    const levels = [
      { index: 0, height: 480, bitrate: 1 },
      { index: 1, height: 1080, bitrate: 2 },
    ];
    sortQualityLevels(levels);
    expect(levels.map((level) => level.height)).toEqual([480, 1080]);
  });

  it("hides the menu when there is nothing to choose between", () => {
    // Native HLS on Safari reports no levels: the browser owns its own ABR.
    expect(hasQualityChoice([])).toBe(false);
    expect(hasQualityChoice([{ index: 0, height: 720, bitrate: 1 }])).toBe(false);
    expect(
      hasQualityChoice([
        { index: 0, height: 720, bitrate: 1 },
        { index: 1, height: 480, bitrate: 1 },
      ])
    ).toBe(true);
  });

  it("keeps hls.js's auto sentinel distinct from a real index", () => {
    expect(AUTO_LEVEL).toBe(-1);
  });
});
