import { describe, expect, it } from "vitest";

import {
  BRANCH_PLACEMENTS,
  branchCardsShouldOpen,
  branchThresholdSec,
  resolveBranchCards,
  resolveBranchHref,
} from "./branch";
import { DEFAULT_LEAD_SECONDS } from "./config";
import type { BranchTarget, BranchingConfig } from "./types";

// The hostile-input half of this file follows app/lib/share/qrTarget.test.ts:
// a branch card's href is written by an owner and clicked by a stranger, so the
// interesting cases are the ones where the string is not the URL it looks like.

const HOST = "marvedge.com";
const HUB_HOST = "demos.acme.com";

/** demoId → slug, as the server resolver hands it over. */
const SLUGS = { "demo-1": "the-slug", "demo-2": "second-slug" };

function demoTarget(demoId: string): BranchTarget {
  return { kind: "demo", demoId };
}

function urlTarget(href: string): BranchTarget {
  return { kind: "url", href };
}

describe("resolveBranchHref — demo targets stay on the viewer's domain", () => {
  it("builds the share URL on the request host", () => {
    expect(resolveBranchHref(demoTarget("demo-1"), HOST, SLUGS)).toBe(
      "https://marvedge.com/share/the-slug"
    );
  });

  it("keeps a customer hub visitor on the customer's own domain", () => {
    // The product bug this closes: sending someone reading demos.acme.com off to
    // marvedge.com halfway through acme's funnel.
    const href = resolveBranchHref(demoTarget("demo-1"), HUB_HOST, SLUGS);
    expect(href).toBe("https://demos.acme.com/share/the-slug");
    expect(href).not.toContain("marvedge.com");
  });

  it("ignores NEXT_PUBLIC_APP_URL entirely", () => {
    // Not mocked, asserted structurally: the only host that can appear in the
    // result is the one passed in. There is no env read on this path to mock.
    const previous = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://app.marvedge.com";
    try {
      expect(resolveBranchHref(demoTarget("demo-2"), HUB_HOST, SLUGS)).toBe(
        "https://demos.acme.com/share/second-slug"
      );
    } finally {
      process.env.NEXT_PUBLIC_APP_URL = previous;
    }
  });

  it("serves a dev hub over http and keeps the port", () => {
    expect(resolveBranchHref(demoTarget("demo-1"), "acme.localhost:3000", SLUGS)).toBe(
      "http://acme.localhost:3000/share/the-slug"
    );
  });

  it("falls back to a root-relative path when there is no usable host", () => {
    // Root-relative stays on the current origin by construction, which is a
    // better answer than guessing an origin and getting the customer's wrong.
    for (const host of [undefined, null, "", "   "]) {
      expect(resolveBranchHref(demoTarget("demo-1"), host, SLUGS)).toBe("/share/the-slug");
    }
  });

  it("does not resolve a demo id the caller could not look up", () => {
    // Deleted, unpublished, or another owner's — all of them arrive here as an
    // absent key, and all of them must produce no card rather than a dead link.
    expect(resolveBranchHref(demoTarget("missing"), HOST, SLUGS)).toBeUndefined();
    expect(resolveBranchHref(demoTarget("demo-1"), HOST, {})).toBeUndefined();
    expect(resolveBranchHref(demoTarget("demo-1"), HOST, { "demo-1": null })).toBeUndefined();
    expect(resolveBranchHref(demoTarget("demo-1"), HOST, { "demo-1": "  " })).toBeUndefined();
  });

  it("escapes a slug rather than letting it reshape the path", () => {
    expect(resolveBranchHref(demoTarget("demo-1"), HOST, { "demo-1": "a/../b" })).toBe(
      "https://marvedge.com/share/a%2F..%2Fb"
    );
  });
});

describe("resolveBranchHref — url targets", () => {
  it("accepts a plain https URL and normalises it", () => {
    expect(resolveBranchHref(urlTarget("  https://example.com/next  "), HOST)).toBe(
      "https://example.com/next"
    );
    expect(resolveBranchHref(urlTarget("https://example.com:8443/a?b=c#d"), HOST)).toBe(
      "https://example.com:8443/a?b=c#d"
    );
  });

  it("rejects every scheme that is not https", () => {
    for (const href of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
      "file:///etc/passwd",
      "http://example.com/x",
    ]) {
      expect(resolveBranchHref(urlTarget(href), HOST)).toBeUndefined();
    }
  });

  it("rejects embedded credentials", () => {
    // https://marvedge.com@evil.example/ has a host of evil.example. No branch
    // target legitimately carries a userinfo section, so refuse it outright
    // rather than resolving it correctly and hoping the reader notices.
    expect(resolveBranchHref(urlTarget("https://user:pass@evil.example/"), HOST)).toBeUndefined();
    expect(
      resolveBranchHref(urlTarget("https://marvedge.com@evil.example/"), HOST)
    ).toBeUndefined();
  });

  it("resolves a protocol-relative href to an absolute https URL", () => {
    // The danger of //evil.example is that it inherits the CURRENT page's
    // scheme and reads as a path. Normalising it to an absolute https URL is
    // what takes that away: what ends up in the href cannot resolve against our
    // own origin, and it is plainly an external link.
    expect(resolveBranchHref(urlTarget("//evil.example/x"), HOST)).toBe("https://evil.example/x");
  });

  it("punycodes a unicode look-alike host instead of preserving the spelling", () => {
    // "mаrvedge.com" with a Cyrillic а. It is allowed — it is an owner-chosen
    // outbound link like any other — but it is normalised, so it can never be
    // mistaken for marvedge.com by anything comparing the stored string.
    const href = resolveBranchHref(urlTarget("https://mаrvedge.com/share/x"), HOST);
    expect(href).toBe("https://xn--mrvedge-2fg.com/share/x");
    expect(new URL(href!).hostname).not.toBe("marvedge.com");
  });

  it("rejects junk without throwing", () => {
    for (const href of ["", "   ", "https://", "not a url", "h".repeat(1000)]) {
      expect(() => resolveBranchHref(urlTarget(href), HOST)).not.toThrow();
      expect(resolveBranchHref(urlTarget(href), HOST)).toBeUndefined();
    }
  });
});

// --- The pair --------------------------------------------------------------

function branching(overrides: Partial<BranchingConfig> = {}): BranchingConfig {
  return {
    enabled: true,
    leadSeconds: DEFAULT_LEAD_SECONDS,
    a: { label: "A", description: "da", thumbnailUrl: "", target: demoTarget("demo-1") },
    b: {
      label: "B",
      description: "db",
      thumbnailUrl: "https://cdn.example.com/b.png",
      target: urlTarget("https://example.com/b"),
    },
    ...overrides,
  };
}

describe("resolveBranchCards", () => {
  it("resolves both cards with their placements", () => {
    const cards = resolveBranchCards(branching(), HOST, SLUGS, {
      "branch-a": "cta-a",
      "branch-b": "cta-b",
    });
    expect(cards.map((c) => c.placement)).toEqual([...BRANCH_PLACEMENTS]);
    expect(cards[0]).toEqual({
      placement: "branch-a",
      kind: "demo",
      label: "A",
      description: "da",
      thumbnailUrl: "",
      href: "https://marvedge.com/share/the-slug",
      ctaId: "cta-a",
    });
    expect(cards[1].href).toBe("https://example.com/b");
    expect(cards[1].thumbnailUrl).toBe("https://cdn.example.com/b.png");
  });

  it("returns nothing when the section is off", () => {
    expect(resolveBranchCards(branching({ enabled: false }), HOST, SLUGS)).toEqual([]);
  });

  it("returns neither card when one target no longer resolves", () => {
    // A pair with one dead side is a choice with one real option, which reads as
    // a broken page rather than as a decision.
    expect(resolveBranchCards(branching(), HOST, {})).toEqual([]);
  });

  it("still resolves a card whose mirrored Cta row is missing", () => {
    const cards = resolveBranchCards(branching(), HOST, SLUGS);
    expect(cards).toHaveLength(2);
    expect(cards[0].ctaId).toBeUndefined();
  });
});

// --- Timing ----------------------------------------------------------------

describe("branchThresholdSec", () => {
  it("is duration minus the lead", () => {
    expect(branchThresholdSec(60, 5)).toBe(55);
  });

  it("has no threshold before metadata loads", () => {
    // Demo.duration is Float? and null on plenty of rows, which is exactly why
    // the player reads the element's duration instead. NaN means "not yet".
    expect(branchThresholdSec(Number.NaN, 5)).toBeUndefined();
    expect(branchThresholdSec(Number.POSITIVE_INFINITY, 5)).toBeUndefined();
    expect(branchThresholdSec(0, 5)).toBeUndefined();
  });

  it("has no threshold for a video shorter than the lead", () => {
    expect(branchThresholdSec(3, 5)).toBeUndefined();
    expect(branchThresholdSec(5, 5)).toBeUndefined();
  });
});

describe("branchCardsShouldOpen", () => {
  const base = { duration: 60, leadSeconds: 5, ended: false };

  it("opens at duration - leadSeconds exactly", () => {
    expect(branchCardsShouldOpen({ ...base, prevTime: 54.9, currentTime: 55 })).toBe(true);
  });

  it("does not open before the threshold", () => {
    expect(branchCardsShouldOpen({ ...base, prevTime: 40, currentTime: 54.9 })).toBe(false);
  });

  it("opens when the viewer scrubs straight past the threshold", () => {
    // No tick lands near 55s on a drag from 0:10 to 0:58, so a timer would never
    // fire for the viewer most likely to want to know what comes next.
    expect(branchCardsShouldOpen({ ...base, prevTime: 10, currentTime: 58 })).toBe(true);
  });

  it("does not re-open on a seek back", () => {
    expect(branchCardsShouldOpen({ ...base, prevTime: 58, currentTime: 10 })).toBe(false);
  });

  it("opens on ended regardless of position", () => {
    expect(branchCardsShouldOpen({ ...base, ended: true, prevTime: 60, currentTime: 60 })).toBe(
      true
    );
  });

  it("opens a video shorter than the lead only on ended", () => {
    const short = { duration: 3, leadSeconds: 5 };
    expect(branchCardsShouldOpen({ ...short, ended: false, prevTime: 0, currentTime: 2.9 })).toBe(
      false
    );
    expect(branchCardsShouldOpen({ ...short, ended: true, prevTime: 2.9, currentTime: 3 })).toBe(
      true
    );
  });

  it("stays shut while the duration is unknown", () => {
    expect(
      branchCardsShouldOpen({
        duration: Number.NaN,
        leadSeconds: 5,
        prevTime: 0,
        currentTime: 30,
        ended: false,
      })
    ).toBe(false);
  });
});
