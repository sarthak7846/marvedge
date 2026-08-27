import { describe, expect, it } from "vitest";

import {
  HONEYPOT_FIELD,
  MIN_TIME_ON_FORM_MS,
  isHoneypotTripped,
  isTooFastSubmission,
  leadSubmissionSchema,
  parseLeadSubmission,
} from "./lead";

/** The smallest body the route will accept. */
function valid(overrides: Record<string, unknown> = {}) {
  return {
    demoId: "demo_123",
    email: "ada@acme.com",
    consent: true,
    ...overrides,
  };
}

describe("leadSubmissionSchema", () => {
  it("accepts a minimal submission", () => {
    expect(leadSubmissionSchema.safeParse(valid()).success).toBe(true);
  });

  it("accepts every optional field", () => {
    const parsed = leadSubmissionSchema.safeParse(
      valid({
        name: "Ada Lovelace",
        companySize: "51-200",
        consentText: "I agree to be contacted.",
        referrer: "https://example.com/page",
        positionSec: 42.5,
        formOpenedAt: 1_700_000_000_000,
        [HONEYPOT_FIELD]: "",
      })
    );
    expect(parsed.success).toBe(true);
  });

  it("REFUSES A SUBMISSION WITH THE CONSENT BOX UNTICKED", () => {
    // Rejected by the schema, not only by the form, so no future caller can
    // forget the check.
    expect(leadSubmissionSchema.safeParse(valid({ consent: false })).success).toBe(false);
    expect(leadSubmissionSchema.safeParse(valid({ consent: undefined })).success).toBe(false);
    expect(leadSubmissionSchema.safeParse(valid({ consent: "true" })).success).toBe(false);
  });

  it("requires a demoId and an email", () => {
    expect(leadSubmissionSchema.safeParse(valid({ demoId: undefined })).success).toBe(false);
    expect(leadSubmissionSchema.safeParse(valid({ demoId: "" })).success).toBe(false);
    expect(leadSubmissionSchema.safeParse(valid({ email: undefined })).success).toBe(false);
    expect(leadSubmissionSchema.safeParse(valid({ email: "" })).success).toBe(false);
  });

  it("rejects a company size outside the fixed buckets", () => {
    // PR 7 groups on this column and PR 4 maps it to a picklist; free text here
    // would break both.
    expect(leadSubmissionSchema.safeParse(valid({ companySize: "about fifty" })).success).toBe(
      false
    );
    expect(leadSubmissionSchema.safeParse(valid({ companySize: 50 })).success).toBe(false);
  });

  it("bounds the strings", () => {
    expect(leadSubmissionSchema.safeParse(valid({ name: "a".repeat(121) })).success).toBe(false);
    expect(
      leadSubmissionSchema.safeParse(valid({ email: `${"a".repeat(255)}@x.com` })).success
    ).toBe(false);
    expect(leadSubmissionSchema.safeParse(valid({ consentText: "a".repeat(501) })).success).toBe(
      false
    );
    expect(leadSubmissionSchema.safeParse(valid({ demoId: "a".repeat(65) })).success).toBe(false);
  });

  it("rejects a non-finite or negative position", () => {
    expect(leadSubmissionSchema.safeParse(valid({ positionSec: -1 })).success).toBe(false);
    expect(leadSubmissionSchema.safeParse(valid({ positionSec: Number.NaN })).success).toBe(false);
  });
});

describe("parseLeadSubmission", () => {
  it("parses a good body", () => {
    const result = parseLeadSubmission(JSON.stringify(valid({ name: "Ada" })));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.lead.email).toBe("ada@acme.com");
      expect(result.lead.name).toBe("Ada");
    }
  });

  it("reports bad JSON and a bad shape separately, and never echoes the input", () => {
    const notJson = parseLeadSubmission("{not json");
    expect(notJson).toEqual({ ok: false, reason: "not_json" });

    const badShape = parseLeadSubmission(JSON.stringify({ email: "ada@acme.com" }));
    expect(badShape).toEqual({ ok: false, reason: "invalid_shape" });

    // The failure result carries no field of the submission at all — a route
    // that logs it cannot leak an address by accident.
    expect(JSON.stringify(badShape)).not.toContain("ada@acme.com");
  });

  it("does not throw on an empty body or a JSON scalar", () => {
    expect(parseLeadSubmission("").ok).toBe(false);
    expect(parseLeadSubmission("null").ok).toBe(false);
    expect(parseLeadSubmission('"a string"').ok).toBe(false);
    expect(parseLeadSubmission("[]").ok).toBe(false);
  });
});

describe("isHoneypotTripped", () => {
  it("is tripped only by a field with something in it", () => {
    expect(isHoneypotTripped("http://spam.example")).toBe(true);
    expect(isHoneypotTripped("")).toBe(false);
    expect(isHoneypotTripped("   ")).toBe(false);
    expect(isHoneypotTripped(undefined)).toBe(false);
    expect(isHoneypotTripped(null)).toBe(false);
  });
});

describe("isTooFastSubmission", () => {
  const now = 1_700_000_000_000;

  it("rejects a submission faster than any human fill", () => {
    expect(isTooFastSubmission(now - 100, now)).toBe(true);
    expect(isTooFastSubmission(now - (MIN_TIME_ON_FORM_MS - 1), now)).toBe(true);
  });

  it("accepts a submission at or past the floor", () => {
    expect(isTooFastSubmission(now - MIN_TIME_ON_FORM_MS, now)).toBe(false);
    expect(isTooFastSubmission(now - 30_000, now)).toBe(false);
  });

  it("FAILS OPEN when the client clock is skewed", () => {
    // A future timestamp means the viewer's clock is wrong, not that they are a
    // bot. Rejecting them would lose real leads on every mis-set device.
    expect(isTooFastSubmission(now + 60_000, now)).toBe(false);
  });

  it("fails open when no timestamp was sent, or it is nonsense", () => {
    expect(isTooFastSubmission(undefined, now)).toBe(false);
    expect(isTooFastSubmission(Number.NaN, now)).toBe(false);
    expect(isTooFastSubmission("1700000000000", now)).toBe(false);
    expect(isTooFastSubmission(null, now)).toBe(false);
  });
});
