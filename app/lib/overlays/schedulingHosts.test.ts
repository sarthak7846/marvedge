import { describe, expect, it } from "vitest";

// Relative, like app/lib/qr/qr.test.ts and app/lib/share/qrTarget.test.ts: there
// is no vitest config resolving the "@/" alias.
import {
  SCHEDULING_FRAME_SRC,
  SCHEDULING_HOSTS,
  buildSchedulingEmbedUrl,
  isAllowedSchedulingHost,
  isSchedulingBookedMessage,
  sanitizeSchedulingUrl,
  schedulingEmbedOrigin,
  splitPrefillName,
} from "./schedulingHosts";

/**
 * The hostile-input suite for the one place this feature frames a third party's
 * document. Written in the style of app/lib/share/qrTarget.test.ts, and for the
 * same reason: every case below is a URL someone could put in the editor, or a
 * row someone could write straight into the database, and each of them has to
 * come back undefined rather than reach an iframe src.
 */
describe("sanitizeSchedulingUrl — what is allowed", () => {
  it("accepts an allow-listed host", () => {
    expect(sanitizeSchedulingUrl("https://calendly.com/acme/30min", "calendly")).toBe(
      "https://calendly.com/acme/30min"
    );
    expect(sanitizeSchedulingUrl("https://meetings.hubspot.com/rep", "hubspot")).toBe(
      "https://meetings.hubspot.com/rep"
    );
  });

  it("accepts a subdomain of an allow-listed host", () => {
    // Calendly serves enterprise accounts from their own subdomain, which is why
    // the match is dot-anchored rather than exact.
    expect(sanitizeSchedulingUrl("https://acme.calendly.com/intro", "calendly")).toBe(
      "https://acme.calendly.com/intro"
    );
    expect(sanitizeSchedulingUrl("https://eu.meetings.hubspot.com/rep", "hubspot")).toBe(
      "https://eu.meetings.hubspot.com/rep"
    );
  });

  it("keeps the query string the owner configured", () => {
    expect(sanitizeSchedulingUrl("https://calendly.com/acme/30min?month=2026-09", "calendly")).toBe(
      "https://calendly.com/acme/30min?month=2026-09"
    );
  });

  it("normalizes the host's case and trims surrounding whitespace", () => {
    expect(sanitizeSchedulingUrl("  https://CALENDLY.COM/acme  ", "calendly")).toBe(
      "https://calendly.com/acme"
    );
  });
});

describe("sanitizeSchedulingUrl — hostile input", () => {
  it("rejects http", () => {
    // https only: this URL is framed on a page that is itself https, where an
    // http frame is blocked as mixed content anyway.
    expect(sanitizeSchedulingUrl("http://calendly.com/acme", "calendly")).toBeUndefined();
    expect(sanitizeSchedulingUrl("HTTP://calendly.com/acme", "calendly")).toBeUndefined();
  });

  it("rejects the look-alike suffix attack", () => {
    // The bug a bare endsWith("calendly.com") or an includes() check waves
    // through, and the reason the match is dot-anchored.
    expect(
      sanitizeSchedulingUrl("https://calendly.com.evil.example/x", "calendly")
    ).toBeUndefined();
    expect(sanitizeSchedulingUrl("https://notcalendly.com/x", "calendly")).toBeUndefined();
    expect(sanitizeSchedulingUrl("https://evil.example/calendly.com", "calendly")).toBeUndefined();
    expect(
      sanitizeSchedulingUrl("https://evil.example/?x=calendly.com", "calendly")
    ).toBeUndefined();
  });

  it("rejects a userinfo-prefixed host", () => {
    // https://calendly.com@evil.example/ has a host of evil.example. The
    // allow-list resolves that correctly on its own; the credentials are refused
    // anyway, because no booking link legitimately carries them.
    expect(
      sanitizeSchedulingUrl("https://calendly.com@evil.example/x", "calendly")
    ).toBeUndefined();
    expect(
      sanitizeSchedulingUrl("https://calendly.com:pass@evil.example/x", "calendly")
    ).toBeUndefined();
    // Even with an allow-listed host, credentials are not accepted.
    expect(sanitizeSchedulingUrl("https://user:pass@calendly.com/x", "calendly")).toBeUndefined();
  });

  it("rejects an IP literal", () => {
    expect(sanitizeSchedulingUrl("https://127.0.0.1/x", "calendly")).toBeUndefined();
    expect(
      sanitizeSchedulingUrl("https://169.254.169.254/latest/meta-data", "calendly")
    ).toBeUndefined();
    expect(sanitizeSchedulingUrl("https://[::1]/x", "calendly")).toBeUndefined();
  });

  it("rejects a protocol-relative URL", () => {
    // It would resolve to something allow-listed, which is exactly why it is
    // worth refusing: a stored booking link that does not say its own scheme is a
    // config mistake, and this parser infers nothing.
    expect(sanitizeSchedulingUrl("//calendly.com/acme", "calendly")).toBeUndefined();
    expect(sanitizeSchedulingUrl("//evil.example/acme", "calendly")).toBeUndefined();
  });

  it("rejects a bare host with no scheme", () => {
    expect(sanitizeSchedulingUrl("calendly.com/acme", "calendly")).toBeUndefined();
  });

  it("rejects dangerous schemes", () => {
    expect(sanitizeSchedulingUrl("javascript:alert(1)", "calendly")).toBeUndefined();
    expect(
      sanitizeSchedulingUrl("data:text/html,<script>alert(1)</script>", "calendly")
    ).toBeUndefined();
    expect(sanitizeSchedulingUrl("file:///etc/passwd", "calendly")).toBeUndefined();
    // A scheme that merely starts with the right letters is not the right scheme.
    expect(sanitizeSchedulingUrl("https:evil.example/x", "calendly")).toBeUndefined();
  });

  it("rejects a host allow-listed for the OTHER provider", () => {
    expect(sanitizeSchedulingUrl("https://calendly.com/x", "hubspot")).toBeUndefined();
    expect(sanitizeSchedulingUrl("https://meetings.hubspot.com/x", "calendly")).toBeUndefined();
  });

  it("rejects a hubspot host that is not the meetings one", () => {
    // Only meetings.hubspot.com is framable, not the logged-in CRM app.
    expect(sanitizeSchedulingUrl("https://app.hubspot.com/x", "hubspot")).toBeUndefined();
    expect(sanitizeSchedulingUrl("https://hubspot.com/x", "hubspot")).toBeUndefined();
  });

  it("rejects a URL longer than the stored bound", () => {
    const long = `https://calendly.com/${"a".repeat(600)}`;
    expect(sanitizeSchedulingUrl(long, "calendly")).toBeUndefined();
  });

  it("rejects junk without throwing", () => {
    for (const junk of [undefined, null, 42, {}, [], "", "   ", "not a url", true, NaN]) {
      expect(() => sanitizeSchedulingUrl(junk, "calendly")).not.toThrow();
      expect(sanitizeSchedulingUrl(junk, "calendly")).toBeUndefined();
    }
  });
});

describe("isAllowedSchedulingHost", () => {
  it("matches on a full hostname, never a substring", () => {
    expect(isAllowedSchedulingHost("calendly.com", "calendly")).toBe(true);
    expect(isAllowedSchedulingHost("acme.calendly.com", "calendly")).toBe(true);
    expect(isAllowedSchedulingHost("calendly.com.evil.example", "calendly")).toBe(false);
    expect(isAllowedSchedulingHost("xcalendly.com", "calendly")).toBe(false);
    expect(isAllowedSchedulingHost("", "calendly")).toBe(false);
  });
});

describe("SCHEDULING_FRAME_SRC", () => {
  it("covers every allow-listed host and its subdomains, https only", () => {
    // Derived rather than retyped, so the CSP cannot fall behind the allow-list.
    for (const root of Object.values(SCHEDULING_HOSTS).flat()) {
      expect(SCHEDULING_FRAME_SRC).toContain(`https://${root}`);
      expect(SCHEDULING_FRAME_SRC).toContain(`https://*.${root}`);
    }
    expect(SCHEDULING_FRAME_SRC.every((source) => source.startsWith("https://"))).toBe(true);
  });
});

describe("buildSchedulingEmbedUrl — the prefill builder", () => {
  const CALENDLY = "https://calendly.com/acme/30min";
  const HUBSPOT = "https://meetings.hubspot.com/rep";

  /** Read the query params back off a built URL. */
  function params(url: string | undefined): URLSearchParams {
    expect(url).toBeDefined();
    return new URL(url as string).searchParams;
  }

  it("re-validates the host at render time", () => {
    // Enforcement point 2: a row that never passed through the save-time
    // sanitiser still cannot produce an iframe src.
    expect(buildSchedulingEmbedUrl("https://evil.example/book", "calendly")).toBeUndefined();
    expect(buildSchedulingEmbedUrl("http://calendly.com/acme", "calendly")).toBeUndefined();
    expect(buildSchedulingEmbedUrl("javascript:alert(1)", "calendly")).toBeUndefined();
    expect(buildSchedulingEmbedUrl(null, "calendly")).toBeUndefined();
  });

  it("omits every field when there is no prefill at all", () => {
    const query = params(buildSchedulingEmbedUrl(CALENDLY, "calendly"));
    expect(query.get("name")).toBeNull();
    expect(query.get("email")).toBeNull();
  });

  it("omits every field when consent was NOT given", () => {
    // The whole point of the flag: a lead we hold is not permission to hand it
    // to a third party.
    const query = params(
      buildSchedulingEmbedUrl(CALENDLY, "calendly", {
        prefill: { name: "Ada Lovelace", email: "ada@example.com", consented: false },
      })
    );
    expect(query.get("name")).toBeNull();
    expect(query.get("email")).toBeNull();
  });

  it("omits fields the viewer never typed", () => {
    // A gate configured without a name field captures no name, and nothing may
    // invent one.
    const query = params(
      buildSchedulingEmbedUrl(CALENDLY, "calendly", {
        prefill: { email: "ada@example.com", consented: true },
      })
    );
    expect(query.get("email")).toBe("ada@example.com");
    expect(query.get("name")).toBeNull();
  });

  it("omits blank and whitespace-only values", () => {
    const query = params(
      buildSchedulingEmbedUrl(CALENDLY, "calendly", {
        prefill: { name: "   ", email: "", consented: true },
      })
    );
    expect(query.get("name")).toBeNull();
    expect(query.get("email")).toBeNull();
  });

  it("passes a consented name and email to calendly", () => {
    const query = params(
      buildSchedulingEmbedUrl(CALENDLY, "calendly", {
        prefill: { name: "Ada Lovelace", email: "ada@example.com", consented: true },
      })
    );
    expect(query.get("name")).toBe("Ada Lovelace");
    expect(query.get("email")).toBe("ada@example.com");
  });

  it("splits the name into hubspot's two fields", () => {
    const query = params(
      buildSchedulingEmbedUrl(HUBSPOT, "hubspot", {
        prefill: { name: "Ada Lovelace", email: "ada@example.com", consented: true },
      })
    );
    expect(query.get("firstName")).toBe("Ada");
    expect(query.get("lastName")).toBe("Lovelace");
    expect(query.get("email")).toBe("ada@example.com");
    // Calendly's single-field spelling must not leak into the hubspot URL.
    expect(query.get("name")).toBeNull();
  });

  it("adds the provider's embed params and no widget script", () => {
    const calendly = params(
      buildSchedulingEmbedUrl(CALENDLY, "calendly", { embedDomain: "demos.acme.com" })
    );
    expect(calendly.get("embed_type")).toBe("Inline");
    // Without embed_domain calendly never postMessages, so meeting_booked would
    // silently never fire.
    expect(calendly.get("embed_domain")).toBe("demos.acme.com");
    expect(calendly.get("hide_gdpr_banner")).toBe("1");

    expect(params(buildSchedulingEmbedUrl(HUBSPOT, "hubspot")).get("embed")).toBe("true");
  });

  it("leaves embed_domain out when there is no location to read", () => {
    expect(params(buildSchedulingEmbedUrl(CALENDLY, "calendly")).get("embed_domain")).toBeNull();
  });

  it("keeps the owner's own query params", () => {
    const query = params(
      buildSchedulingEmbedUrl("https://calendly.com/acme/30min?month=2026-09", "calendly")
    );
    expect(query.get("month")).toBe("2026-09");
  });

  it("bounds a prefilled value rather than growing the URL without limit", () => {
    const query = params(
      buildSchedulingEmbedUrl(CALENDLY, "calendly", {
        prefill: { name: "a".repeat(500), email: "ada@example.com", consented: true },
      })
    );
    expect((query.get("name") ?? "").length).toBe(120);
  });
});

describe("splitPrefillName", () => {
  it("gives everything after the first token to the last name", () => {
    // Not "the last token": that mangles every name with a particle in it.
    expect(splitPrefillName("Ada King Lovelace")).toEqual({
      firstName: "Ada",
      lastName: "King Lovelace",
    });
    expect(splitPrefillName("Ada van der Lovelace")).toEqual({
      firstName: "Ada",
      lastName: "van der Lovelace",
    });
  });

  it("leaves the last name for the viewer to fill when they gave one word", () => {
    expect(splitPrefillName("Ada")).toEqual({ firstName: "Ada" });
    expect(splitPrefillName("   ")).toEqual({ firstName: "" });
  });
});

describe("schedulingEmbedOrigin", () => {
  it("is the validated URL's own origin, not a constant", () => {
    // An owner on their own calendly subdomain must not have messages from the
    // apex accepted, and vice versa.
    expect(schedulingEmbedOrigin("https://acme.calendly.com/intro", "calendly")).toBe(
      "https://acme.calendly.com"
    );
    expect(schedulingEmbedOrigin("https://calendly.com/acme", "calendly")).toBe(
      "https://calendly.com"
    );
  });

  it("trusts no origin for a URL that does not validate", () => {
    expect(schedulingEmbedOrigin("https://evil.example/x", "calendly")).toBeUndefined();
    expect(schedulingEmbedOrigin(undefined, "calendly")).toBeUndefined();
  });
});

describe("isSchedulingBookedMessage", () => {
  it("recognises calendly's documented event", () => {
    expect(isSchedulingBookedMessage("calendly", { event: "calendly.event_scheduled" })).toBe(true);
  });

  it("ignores calendly's other lifecycle events", () => {
    // The widget posts several; only one is a booking.
    for (const event of [
      "calendly.profile_page_viewed",
      "calendly.event_type_viewed",
      "calendly.date_and_time_selected",
    ]) {
      expect(isSchedulingBookedMessage("calendly", { event })).toBe(false);
    }
  });

  it("does not accept a hubspot-shaped message on the calendly path", () => {
    expect(isSchedulingBookedMessage("calendly", { meetingBookSucceeded: true })).toBe(false);
  });

  it("matches hubspot's observed shape — best effort, see the module header", () => {
    expect(isSchedulingBookedMessage("hubspot", { meetingBookSucceeded: true })).toBe(true);
    expect(isSchedulingBookedMessage("hubspot", { event: "meetingBookSucceeded" })).toBe(true);
    expect(isSchedulingBookedMessage("hubspot", { meetingBookSucceeded: "yes" })).toBe(false);
  });

  it("returns false for junk without throwing", () => {
    for (const junk of [undefined, null, "calendly.event_scheduled", 42, []]) {
      expect(() => isSchedulingBookedMessage("calendly", junk)).not.toThrow();
      expect(isSchedulingBookedMessage("calendly", junk)).toBe(false);
    }
  });
});
