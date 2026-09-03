import { describe, expect, it } from "vitest";

import { classifySource, isHlsUrl } from "./source";

describe("isHlsUrl", () => {
  it("recognises a plain playlist", () => {
    expect(isHlsUrl("https://cdn.example.com/v/master.m3u8")).toBe(true);
    expect(isHlsUrl("/hls/master.m3u8")).toBe(true);
    expect(isHlsUrl("master.m3u8")).toBe(true);
  });

  it("recognises a playlist behind a presigned query string", () => {
    // The case an endsWith on the raw URL gets wrong. Every R2 playlist PR 8
    // produces will look like this, and misclassifying it means Safari is
    // handed nothing and hls.js is never loaded.
    expect(
      isHlsUrl("https://r2.example.com/v/master.m3u8?X-Amz-Signature=abc&X-Amz-Expires=900")
    ).toBe(true);
    expect(isHlsUrl("https://cdn.example.com/master.m3u8#t=10")).toBe(true);
  });

  it("is case-insensitive on the extension", () => {
    expect(isHlsUrl("https://cdn.example.com/MASTER.M3U8")).toBe(true);
  });

  it("rejects the progressive MP4s that are the only thing exported today", () => {
    expect(isHlsUrl("https://cdn.example.com/export.mp4")).toBe(false);
    expect(isHlsUrl("https://cdn.example.com/export.webm")).toBe(false);
  });

  it("does not match .m3u8 appearing somewhere other than the path's end", () => {
    expect(isHlsUrl("https://cdn.example.com/export.mp4?from=master.m3u8")).toBe(false);
    expect(isHlsUrl("https://cdn.example.com/m3u8/export.mp4")).toBe(false);
  });

  it("treats unusable input as not-HLS", () => {
    expect(isHlsUrl("")).toBe(false);
    expect(isHlsUrl(undefined as unknown as string)).toBe(false);
  });
});

describe("classifySource", () => {
  it("sends every non-playlist URL down the progressive path, whatever the browser can do", () => {
    expect(classifySource("https://cdn.example.com/export.mp4", true)).toBe("progressive");
    expect(classifySource("https://cdn.example.com/export.mp4", false)).toBe("progressive");
  });

  it("prefers the browser's own HLS over hls.js", () => {
    // Safari's built-in player is hardware-accelerated, does AirPlay, and costs
    // no dynamic import.
    expect(classifySource("https://cdn.example.com/master.m3u8", true)).toBe("hls-native");
  });

  it("falls back to hls.js where the browser cannot play a playlist", () => {
    expect(classifySource("https://cdn.example.com/master.m3u8", false)).toBe("hls-js");
  });
});
