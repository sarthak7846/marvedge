import { describe, expect, it } from "vitest";

// Relative, like app/lib/qr/qr.test.ts and app/lib/share/qrTarget.test.ts: there
// is no vitest config resolving the "@/" alias.
import {
  DEFAULT_LEAD_SECONDS,
  DEFAULT_OVERLAY_CONFIG,
  MAX_LEAD_SECONDS,
  MIN_LEAD_SECONDS,
  defaultOverlayConfig,
  overlayConfigFromRow,
  sanitizeBranchTarget,
  sanitizeOverlayConfig,
  sanitizeSchedulingUrl,
  toHttpUrl,
} from "./config";

/** A config whose branch targets and scheduling URL are all valid. */
function fullConfig() {
  return {
    enabled: true,
    leadGate: {
      enabled: true,
      mode: "hard",
      triggerAt: { sec: 12 },
      fields: { name: true, email: true, companySize: true },
      requireWorkEmail: true,
      copy: {
        heading: "Heading",
        subheading: "Subheading",
        submitLabel: "Go",
        skipLabel: "Skip",
      },
      consentText: "I agree.",
      privacyPolicyUrl: "https://example.com/privacy",
    },
    branching: {
      enabled: true,
      leadSeconds: 8,
      a: { label: "A", description: "da", target: { kind: "demo", demoId: "abc-123" } },
      b: { label: "B", description: "db", target: { kind: "url", href: "https://example.com/b" } },
    },
    scheduling: {
      enabled: true,
      provider: "calendly",
      url: "https://calendly.com/acme/30min",
      prefill: true,
    },
  };
}

describe("sanitizeOverlayConfig — garbage never throws", () => {
  // The whole point of the sanitiser: this runs on an unauthenticated public
  // page, so a malformed row must degrade to "no overlays", never 500.
  const garbage: unknown[] = [
    undefined,
    null,
    "",
    "not a config",
    42,
    true,
    [],
    [1, 2, 3],
    { leadGate: "nope", branching: 7, scheduling: [] },
    { enabled: "yes", leadGate: { fields: "all", copy: 12, triggerAt: [] } },
    { branching: { a: null, b: undefined, leadSeconds: "soon" } },
    { scheduling: { provider: {}, url: {}, prefill: "maybe" } },
  ];

  for (const input of garbage) {
    it(`degrades ${JSON.stringify(input) ?? "undefined"} to defaults`, () => {
      expect(() => sanitizeOverlayConfig(input)).not.toThrow();
      expect(sanitizeOverlayConfig(input)).toEqual(defaultOverlayConfig());
    });
  }

  it("never returns a section that is missing or null", () => {
    const config = sanitizeOverlayConfig({ enabled: true });
    expect(config.leadGate).toBeTypeOf("object");
    expect(config.branching).toBeTypeOf("object");
    expect(config.scheduling).toBeTypeOf("object");
  });

  it("defaults to everything off, so no row behaves like no feature", () => {
    expect(DEFAULT_OVERLAY_CONFIG.enabled).toBe(false);
    expect(DEFAULT_OVERLAY_CONFIG.leadGate.enabled).toBe(false);
    expect(DEFAULT_OVERLAY_CONFIG.branching.enabled).toBe(false);
    expect(DEFAULT_OVERLAY_CONFIG.scheduling.enabled).toBe(false);
  });
});

describe("sanitizeOverlayConfig — round trip", () => {
  it("preserves a fully valid config", () => {
    const config = sanitizeOverlayConfig(fullConfig());
    expect(config.enabled).toBe(true);
    expect(config.leadGate.mode).toBe("hard");
    expect(config.leadGate.triggerAt).toEqual({ sec: 12 });
    expect(config.branching.enabled).toBe(true);
    expect(config.branching.leadSeconds).toBe(8);
    expect(config.scheduling.url).toBe("https://calendly.com/acme/30min");
  });

  it("is idempotent", () => {
    const once = sanitizeOverlayConfig(fullConfig());
    expect(sanitizeOverlayConfig(once)).toEqual(once);
  });
});

describe("sanitizeOverlayConfig — unknown keys", () => {
  it("drops unknown top-level keys", () => {
    const config = sanitizeOverlayConfig({
      ...fullConfig(),
      somethingElse: "smuggled",
      __proto__hack: { a: 1 },
    });
    expect(config).not.toHaveProperty("somethingElse");
    expect(config).not.toHaveProperty("__proto__hack");
    expect(Object.keys(config).sort()).toEqual(["branching", "enabled", "leadGate", "scheduling"]);
  });

  it("drops unknown keys inside every section", () => {
    const base = fullConfig();
    const config = sanitizeOverlayConfig({
      ...base,
      leadGate: { ...base.leadGate, injected: "x" },
      branching: { ...base.branching, injected: "x" },
      scheduling: { ...base.scheduling, injected: "x" },
    });
    expect(config.leadGate).not.toHaveProperty("injected");
    expect(config.branching).not.toHaveProperty("injected");
    expect(config.scheduling).not.toHaveProperty("injected");
  });
});

describe("sanitizeOverlayConfig — leadSeconds clamping", () => {
  const leadSecondsOf = (leadSeconds: unknown) =>
    sanitizeOverlayConfig({ branching: { leadSeconds } }).branching.leadSeconds;

  it("clamps below the minimum up to it", () => {
    expect(leadSecondsOf(0)).toBe(MIN_LEAD_SECONDS);
    expect(leadSecondsOf(-90)).toBe(MIN_LEAD_SECONDS);
  });

  it("clamps above the maximum down to it", () => {
    expect(leadSecondsOf(999)).toBe(MAX_LEAD_SECONDS);
    expect(leadSecondsOf(Number.MAX_SAFE_INTEGER)).toBe(MAX_LEAD_SECONDS);
  });

  it("keeps a value already in range", () => {
    expect(leadSecondsOf(5)).toBe(5);
    expect(leadSecondsOf(MIN_LEAD_SECONDS)).toBe(MIN_LEAD_SECONDS);
    expect(leadSecondsOf(MAX_LEAD_SECONDS)).toBe(MAX_LEAD_SECONDS);
  });

  it("falls back to the default for non-finite and non-numeric values", () => {
    expect(leadSecondsOf(Number.NaN)).toBe(DEFAULT_LEAD_SECONDS);
    expect(leadSecondsOf(Number.POSITIVE_INFINITY)).toBe(DEFAULT_LEAD_SECONDS);
    expect(leadSecondsOf("5")).toBe(DEFAULT_LEAD_SECONDS);
    expect(leadSecondsOf(null)).toBe(DEFAULT_LEAD_SECONDS);
  });
});

describe("sanitizeSchedulingUrl — host allow-list", () => {
  it("accepts the allow-listed hosts and their subdomains", () => {
    expect(sanitizeSchedulingUrl("https://calendly.com/acme/30min", "calendly")).toBe(
      "https://calendly.com/acme/30min"
    );
    expect(sanitizeSchedulingUrl("https://acme.calendly.com/intro", "calendly")).toBe(
      "https://acme.calendly.com/intro"
    );
    expect(sanitizeSchedulingUrl("https://meetings.hubspot.com/rep", "hubspot")).toBe(
      "https://meetings.hubspot.com/rep"
    );
  });

  it("rejects the look-alike suffix attack", () => {
    // The bug a bare endsWith("calendly.com") or an includes() check would let
    // through, and the reason qrTarget.ts matches dot-anchored.
    expect(
      sanitizeSchedulingUrl("https://calendly.com.evil.example/x", "calendly")
    ).toBeUndefined();
    expect(sanitizeSchedulingUrl("https://notcalendly.com/x", "calendly")).toBeUndefined();
    expect(sanitizeSchedulingUrl("https://evil.example/calendly.com", "calendly")).toBeUndefined();
  });

  it("rejects a host allow-listed for the OTHER provider", () => {
    expect(sanitizeSchedulingUrl("https://calendly.com/x", "hubspot")).toBeUndefined();
    expect(sanitizeSchedulingUrl("https://meetings.hubspot.com/x", "calendly")).toBeUndefined();
  });

  it("rejects a non-hubspot hubspot subdomain", () => {
    // Only meetings.hubspot.com is framed, not the whole of hubspot.com.
    expect(sanitizeSchedulingUrl("https://app.hubspot.com/x", "hubspot")).toBeUndefined();
    expect(sanitizeSchedulingUrl("https://hubspot.com/x", "hubspot")).toBeUndefined();
  });

  it("rejects credentials in the authority", () => {
    // https://calendly.com@evil.example/ has a host of evil.example.
    expect(
      sanitizeSchedulingUrl("https://calendly.com@evil.example/x", "calendly")
    ).toBeUndefined();
  });

  it("rejects non-https and dangerous schemes", () => {
    expect(sanitizeSchedulingUrl("http://calendly.com/x", "calendly")).toBeUndefined();
    expect(sanitizeSchedulingUrl("javascript:alert(1)", "calendly")).toBeUndefined();
    expect(sanitizeSchedulingUrl("data:text/html,<script>", "calendly")).toBeUndefined();
  });

  it("rejects junk without throwing", () => {
    for (const junk of [undefined, null, 42, {}, [], "", "   ", "not a url"]) {
      expect(() => sanitizeSchedulingUrl(junk, "calendly")).not.toThrow();
      expect(sanitizeSchedulingUrl(junk, "calendly")).toBeUndefined();
    }
  });
});

describe("sanitizeOverlayConfig — scheduling section", () => {
  it("forces the section off when the host is not allow-listed", () => {
    const config = sanitizeOverlayConfig({
      scheduling: { enabled: true, provider: "calendly", url: "https://evil.example/book" },
    });
    // Off rather than on-with-an-empty-iframe: a broken widget is worse than none.
    expect(config.scheduling.enabled).toBe(false);
    expect(config.scheduling.url).toBe("");
  });

  it("falls back to calendly for an unknown provider", () => {
    const config = sanitizeOverlayConfig({
      scheduling: { enabled: true, provider: "zoom", url: "https://calendly.com/x" },
    });
    expect(config.scheduling.provider).toBe("calendly");
    expect(config.scheduling.enabled).toBe(true);
  });
});

describe("sanitizeBranchTarget — exactly two variants", () => {
  it("accepts the demo variant", () => {
    expect(sanitizeBranchTarget({ kind: "demo", demoId: "abc-123" })).toEqual({
      kind: "demo",
      demoId: "abc-123",
    });
  });

  it("accepts the url variant and normalizes it", () => {
    expect(sanitizeBranchTarget({ kind: "url", href: "example.com/next" })).toEqual({
      kind: "url",
      href: "https://example.com/next",
    });
  });

  it("rejects a tutorial variant", () => {
    // Locked decision: Tutorial/Slide has no viewer page, so such a card would
    // route the viewer at a 404. A hand-edited row must not resurrect it.
    expect(sanitizeBranchTarget({ kind: "tutorial", tutorialId: "t1" })).toBeUndefined();
  });

  it("rejects a demo id outside the id charset", () => {
    expect(sanitizeBranchTarget({ kind: "demo", demoId: "../../etc/passwd" })).toBeUndefined();
    expect(sanitizeBranchTarget({ kind: "demo", demoId: "" })).toBeUndefined();
    expect(sanitizeBranchTarget({ kind: "demo", demoId: "a".repeat(200) })).toBeUndefined();
  });

  it("rejects a dangerous href", () => {
    expect(sanitizeBranchTarget({ kind: "url", href: "javascript:alert(1)" })).toBeUndefined();
    expect(sanitizeBranchTarget({ kind: "url", href: "https://a@b.example/" })).toBeUndefined();
  });

  it("rejects junk without throwing", () => {
    for (const junk of [undefined, null, 42, "url", [], {}]) {
      expect(() => sanitizeBranchTarget(junk)).not.toThrow();
      expect(sanitizeBranchTarget(junk)).toBeUndefined();
    }
  });
});

describe("sanitizeOverlayConfig — branching section", () => {
  it("forces the section off when either target is unusable", () => {
    const input = fullConfig();
    input.branching.b.target = { kind: "url", href: "javascript:alert(1)" } as never;
    expect(sanitizeOverlayConfig(input).branching.enabled).toBe(false);
  });

  it("keeps the section on when both targets are usable", () => {
    expect(sanitizeOverlayConfig(fullConfig()).branching.enabled).toBe(true);
  });
});

describe("sanitizeOverlayConfig — lead gate", () => {
  it("always collects an email, whatever the row says", () => {
    // The email IS the lead; a gate that collects none interrupts for nothing.
    const config = sanitizeOverlayConfig({
      leadGate: { fields: { name: false, email: false, companySize: false } },
    });
    expect(config.leadGate.fields.email).toBe(true);
  });

  it("clamps an explicit trigger offset and rejects a junk one", () => {
    expect(
      sanitizeOverlayConfig({ leadGate: { triggerAt: { sec: -5 } } }).leadGate.triggerAt
    ).toEqual({ sec: 0 });
    expect(
      sanitizeOverlayConfig({ leadGate: { triggerAt: { sec: 1e9 } } }).leadGate.triggerAt
    ).toEqual({ sec: 21600 });
    expect(sanitizeOverlayConfig({ leadGate: { triggerAt: "whenever" } }).leadGate.triggerAt).toBe(
      "mid"
    );
    expect(
      sanitizeOverlayConfig({ leadGate: { triggerAt: { sec: "5" } } }).leadGate.triggerAt
    ).toBe("mid");
  });

  it("keeps the two symbolic triggers", () => {
    expect(sanitizeOverlayConfig({ leadGate: { triggerAt: "start" } }).leadGate.triggerAt).toBe(
      "start"
    );
    expect(sanitizeOverlayConfig({ leadGate: { triggerAt: "mid" } }).leadGate.triggerAt).toBe(
      "mid"
    );
  });

  it("caps owner-authored copy rather than rendering unbounded text", () => {
    const config = sanitizeOverlayConfig({ leadGate: { copy: { heading: "x".repeat(5000) } } });
    expect(config.leadGate.copy.heading.length).toBeLessThanOrEqual(120);
  });

  it("drops a privacy policy URL that is not http(s)", () => {
    expect(
      sanitizeOverlayConfig({ leadGate: { privacyPolicyUrl: "javascript:alert(1)" } }).leadGate
        .privacyPolicyUrl
    ).toBe("");
  });

  it("ships a default consent sentence with an {owner} placeholder", () => {
    expect(DEFAULT_OVERLAY_CONFIG.leadGate.consentText).toContain("{owner}");
  });
});

describe("toHttpUrl", () => {
  it("promotes a bare host to https rather than guessing", () => {
    expect(toHttpUrl("example.com/x")).toBe("https://example.com/x");
  });

  it("allows http unless httpsOnly is set", () => {
    expect(toHttpUrl("http://example.com/x")).toBe("http://example.com/x");
    expect(toHttpUrl("http://example.com/x", { httpsOnly: true })).toBeUndefined();
  });

  it("rejects dangerous schemes, credentials and overlong input", () => {
    expect(toHttpUrl("javascript:alert(1)")).toBeUndefined();
    expect(toHttpUrl("data:text/html,<script>")).toBeUndefined();
    expect(toHttpUrl("file:///etc/passwd")).toBeUndefined();
    expect(toHttpUrl("https://user:pass@example.com/")).toBeUndefined();
    expect(toHttpUrl(`https://example.com/${"x".repeat(600)}`)).toBeUndefined();
  });
});

describe("overlayConfigFromRow", () => {
  it("reads a missing row as the defaults", () => {
    expect(overlayConfigFromRow(null)).toEqual(defaultOverlayConfig());
    expect(overlayConfigFromRow(undefined)).toEqual(defaultOverlayConfig());
  });

  it("reads null Json columns as default sections", () => {
    const config = overlayConfigFromRow({
      enabled: true,
      leadGate: null,
      branching: null,
      scheduling: null,
    });
    expect(config.enabled).toBe(true);
    expect(config.leadGate).toEqual(defaultOverlayConfig().leadGate);
  });

  it("sanitises a row written by an older schema version", () => {
    const config = overlayConfigFromRow({
      enabled: true,
      leadGate: { mode: "nagging", retiredField: 1 },
      branching: { leadSeconds: 900 },
      scheduling: { provider: "zoom", url: "https://evil.example" },
    });
    expect(config.leadGate.mode).toBe("soft");
    expect(config.leadGate).not.toHaveProperty("retiredField");
    expect(config.branching.leadSeconds).toBe(MAX_LEAD_SECONDS);
    expect(config.scheduling.enabled).toBe(false);
  });
});
