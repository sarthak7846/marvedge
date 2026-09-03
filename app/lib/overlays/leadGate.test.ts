import { describe, expect, it } from "vitest";

import {
  COMPANY_SIZE_BUCKETS,
  CONSENT_OWNER_FALLBACK,
  MAX_CONSENT_TEXT_LENGTH,
  gateShouldOpen,
  isCompanySize,
  leadConsentText,
  renderConsentText,
  resolveGateTriggerSec,
} from "./leadGate";
import { DEFAULT_CONSENT_TEXT } from "./config";

describe("COMPANY_SIZE_BUCKETS", () => {
  it("is a closed set that isCompanySize agrees with", () => {
    for (const bucket of COMPANY_SIZE_BUCKETS) {
      expect(isCompanySize(bucket)).toBe(true);
    }
    expect(isCompanySize("about fifty")).toBe(false);
    expect(isCompanySize("")).toBe(false);
    expect(isCompanySize(50)).toBe(false);
    expect(isCompanySize(undefined)).toBe(false);
  });
});

describe("resolveGateTriggerSec", () => {
  it("resolves 'start' to zero, with or without a duration", () => {
    expect(resolveGateTriggerSec("start", Number.NaN)).toBe(0);
    expect(resolveGateTriggerSec("start", 120)).toBe(0);
  });

  it("resolves 'mid' to half the duration", () => {
    expect(resolveGateTriggerSec("mid", 120)).toBe(60);
    expect(resolveGateTriggerSec("mid", 7)).toBe(3.5);
  });

  it("cannot resolve 'mid' before metadata loads", () => {
    // duration is NaN until loadedmetadata. A gate placed at NaN/2 never fires.
    expect(resolveGateTriggerSec("mid", Number.NaN)).toBeUndefined();
    expect(resolveGateTriggerSec("mid", 0)).toBeUndefined();
    expect(resolveGateTriggerSec("mid", Number.POSITIVE_INFINITY)).toBeUndefined();
  });

  it("passes an explicit offset through when it is inside the video", () => {
    expect(resolveGateTriggerSec({ sec: 30 }, 120)).toBe(30);
    expect(resolveGateTriggerSec({ sec: 0 }, 120)).toBe(0);
  });

  it("uses an explicit offset unclamped while the duration is unknown", () => {
    expect(resolveGateTriggerSec({ sec: 30 }, Number.NaN)).toBe(30);
  });

  it("CLAMPS an offset past the end of the video, so a misconfigured gate still fires", () => {
    // 90s configured on a 60s demo. Without the clamp the owner sees no gate,
    // no leads and no error anywhere.
    expect(resolveGateTriggerSec({ sec: 90 }, 60)).toBe(60);
  });

  it("rejects a nonsense offset rather than guessing", () => {
    expect(resolveGateTriggerSec({ sec: -5 }, 120)).toBeUndefined();
    expect(resolveGateTriggerSec({ sec: Number.NaN }, 120)).toBeUndefined();
    expect(resolveGateTriggerSec({ sec: Number.POSITIVE_INFINITY }, 120)).toBeUndefined();
    expect(resolveGateTriggerSec({ sec: "30" } as unknown as { sec: number }, 120)).toBeUndefined();
  });
});

describe("gateShouldOpen", () => {
  const at = (
    triggerSec: number | undefined,
    prevTime: number,
    currentTime: number,
    paused = false
  ) => gateShouldOpen({ triggerSec, prevTime, currentTime, paused });

  it("never opens while the trigger is unresolved", () => {
    expect(at(undefined, 0, 999)).toBe(false);
  });

  it("opens at the exact boundary and not one tick before it", () => {
    expect(at(30, 29.9, 29.99)).toBe(false);
    expect(at(30, 29.9, 30)).toBe(true);
    expect(at(30, 29.9, 30.1)).toBe(true);
  });

  it("does not re-open once the playhead is already past the trigger", () => {
    // The caller latches too, but the crossing test must not keep answering
    // yes on every subsequent tick of a video that is already past the point.
    expect(at(30, 30, 30.5)).toBe(false);
    expect(at(30, 45, 46)).toBe(false);
  });

  it("OPENS FOR A VIEWER WHO SCRUBS CLEAN OVER THE TRIGGER", () => {
    // The whole reason this is a crossing test: no tick ever lands near 30.
    expect(at(30, 5, 110)).toBe(true);
  });

  it("does not fire on a backwards seek over the trigger", () => {
    expect(at(30, 110, 5)).toBe(false);
  });

  it("does not fire on a video that never reaches the trigger", () => {
    // A 20s video with a resolved trigger at 30s: every tick is below it.
    // (resolveGateTriggerSec() clamps this case away once the duration is
    // known; this asserts the crossing test is safe when it is not.)
    expect(at(30, 0, 10)).toBe(false);
    expect(at(30, 10, 19.9)).toBe(false);
  });

  describe("a trigger at zero, which is not a crossing", () => {
    it("stays shut on a paused video sitting at the very start", () => {
      // No autoplay: the page loads, nothing has happened, no gate.
      expect(at(0, 0, 0, true)).toBe(false);
    });

    it("opens the moment playback starts", () => {
      expect(at(0, 0, 0, false)).toBe(true);
    });

    it("opens when a paused viewer scrubs off zero", () => {
      expect(at(0, 0, 12, true)).toBe(true);
    });
  });
});

describe("renderConsentText", () => {
  it("substitutes {owner} with the first usable candidate", () => {
    expect(renderConsentText(DEFAULT_CONSENT_TEXT, "Acme Inc")).toBe(
      "I agree to be contacted about this product, and to my details being shared with Acme Inc."
    );
  });

  it("falls through empty candidates in order", () => {
    expect(renderConsentText("shared with {owner}.", null, "   ", "Acme Hub")).toBe(
      "shared with Acme Hub."
    );
  });

  it("falls back to a readable phrase when nothing is known", () => {
    expect(renderConsentText("shared with {owner}.", null, undefined, "")).toBe(
      `shared with ${CONSENT_OWNER_FALLBACK}.`
    );
    expect(renderConsentText("shared with {owner}.")).toBe(
      `shared with ${CONSENT_OWNER_FALLBACK}.`
    );
  });

  it("substitutes every occurrence, not just the first", () => {
    expect(renderConsentText("{owner} and {owner}", "Acme")).toBe("Acme and Acme");
  });

  it("leaves a template with no placeholder alone", () => {
    expect(renderConsentText("I agree to be contacted.", "Acme")).toBe("I agree to be contacted.");
  });
});

describe("leadConsentText", () => {
  it("records the string that was on screen", () => {
    const onScreen = "I agree to be contacted, and to my details being shared with Acme Inc.";
    expect(leadConsentText(onScreen, "anything else")).toBe(onScreen);
  });

  it("A LATER REWORD DOES NOT CHANGE AN EXISTING LEAD'S RECORDED CONSENT", () => {
    // The load-bearing property of the whole feature. A lead captured under v1
    // copy is stored as a SNAPSHOT; the owner then rewords the demo's consent
    // text, and re-deriving the stored value with the new template must produce
    // the same string it always did.
    const shownAtSubmitTime = renderConsentText(DEFAULT_CONSENT_TEXT, "Acme Inc");
    const stored = leadConsentText(shownAtSubmitTime, renderConsentText(DEFAULT_CONSENT_TEXT));

    const rewordedTemplate = "By continuing you agree {owner} may contact you about anything.";
    const nowOnScreen = renderConsentText(rewordedTemplate, "Acme Inc");

    expect(nowOnScreen).not.toBe(stored);
    expect(leadConsentText(shownAtSubmitTime, nowOnScreen)).toBe(stored);
    expect(stored).toBe(
      "I agree to be contacted about this product, and to my details being shared with Acme Inc."
    );
  });

  it("falls back to the server-rendered current copy when no snapshot was sent", () => {
    const fallback = renderConsentText(DEFAULT_CONSENT_TEXT, "Acme Inc");
    expect(leadConsentText(undefined, fallback)).toBe(fallback);
    expect(leadConsentText("   ", fallback)).toBe(fallback);
    expect(leadConsentText(42, fallback)).toBe(fallback);
  });

  it("bounds what can be stored", () => {
    const huge = "x".repeat(MAX_CONSENT_TEXT_LENGTH + 500);
    expect(leadConsentText(huge, "").length).toBe(MAX_CONSENT_TEXT_LENGTH);
  });
});
