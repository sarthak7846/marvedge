import { describe, expect, it } from "vitest";

import { defaultOverlayConfig } from "./config";
import {
  DEFAULT_SIGNED_MEDIA_TTL_SECONDS,
  MAX_SIGNED_MEDIA_TTL_SECONDS,
  MIN_SIGNED_MEDIA_TTL_SECONDS,
  isMediaGated,
  parseSignedMediaTtl,
} from "./mediaAccess";
import type { LeadGateMode, OverlayConfig } from "./types";

function configWithGate(mode: LeadGateMode, enabled = true): OverlayConfig {
  const config = defaultOverlayConfig();
  return {
    ...config,
    enabled: true,
    leadGate: { ...config.leadGate, enabled, mode },
  };
}

describe("parseSignedMediaTtl", () => {
  it("defaults when unset or unparseable", () => {
    expect(parseSignedMediaTtl(undefined)).toBe(DEFAULT_SIGNED_MEDIA_TTL_SECONDS);
    expect(parseSignedMediaTtl("")).toBe(DEFAULT_SIGNED_MEDIA_TTL_SECONDS);
    expect(parseSignedMediaTtl("   ")).toBe(DEFAULT_SIGNED_MEDIA_TTL_SECONDS);
    expect(parseSignedMediaTtl("soon")).toBe(DEFAULT_SIGNED_MEDIA_TTL_SECONDS);
  });

  it("defaults rather than expiring immediately on a zero or negative value", () => {
    // A mistyped env var must not mean "every signed URL is already dead".
    expect(parseSignedMediaTtl("0")).toBe(DEFAULT_SIGNED_MEDIA_TTL_SECONDS);
    expect(parseSignedMediaTtl("-300")).toBe(DEFAULT_SIGNED_MEDIA_TTL_SECONDS);
  });

  it("takes a value inside the bounds", () => {
    expect(parseSignedMediaTtl("300")).toBe(300);
    expect(parseSignedMediaTtl(" 1800 ")).toBe(1800);
  });

  it("clamps rather than rejecting an out-of-bounds value", () => {
    // Under a minute expires mid-video and stalls the player; a day is a public
    // URL with extra steps.
    expect(parseSignedMediaTtl("5")).toBe(MIN_SIGNED_MEDIA_TTL_SECONDS);
    expect(parseSignedMediaTtl("86400")).toBe(MAX_SIGNED_MEDIA_TTL_SECONDS);
  });
});

describe("isMediaGated", () => {
  const on = { signedMediaEnabled: true, planAllowed: true };

  it("withholds media for a hard gate", () => {
    expect(isMediaGated({ ...on, config: configWithGate("hard") })).toBe(true);
  });

  it("does not withhold media for a soft gate", () => {
    // A soft gate is one the viewer may skip. Withholding the media behind it
    // would silently convert it into a hard one.
    expect(isMediaGated({ ...on, config: configWithGate("soft") })).toBe(false);
  });

  it("does not withhold media when the gate section is off", () => {
    expect(isMediaGated({ ...on, config: configWithGate("hard", false) })).toBe(false);
  });

  it("does not withhold media when the whole overlay layer is off", () => {
    const config = { ...configWithGate("hard"), enabled: false };
    expect(isMediaGated({ ...on, config })).toBe(false);
  });

  it("does not withhold media when the sub-flag is off", () => {
    expect(
      isMediaGated({ signedMediaEnabled: false, planAllowed: true, config: configWithGate("hard") })
    ).toBe(false);
  });

  it("does not withhold media from a demo whose owner downgraded", () => {
    // The lead gate is PRO/ENTERPRISE. An owner who enabled it and then
    // downgraded still has `enabled: true` in the row, and a public page is not
    // the place to discover that — least of all by refusing to play the video.
    expect(
      isMediaGated({ signedMediaEnabled: true, planAllowed: false, config: configWithGate("hard") })
    ).toBe(false);
  });

  it("is off for a default config", () => {
    expect(isMediaGated({ ...on, config: defaultOverlayConfig() })).toBe(false);
  });
});
