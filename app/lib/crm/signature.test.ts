import { describe, expect, it } from "vitest";

import {
  SIGNATURE_PREFIX,
  signWebhookPayload,
  signedPayload,
  verifyWebhookSignature,
} from "./signature";

// A HAND-COMPUTED FIXTURE, produced outside this codebase so the test is not
// just this implementation agreeing with itself:
//
//   printf '%s' '1700000000.{"event":"lead.created","id":"lead_123"}' \
//     | openssl dgst -sha256 -hmac 'whsec_marvedge_test' -hex
//   SHA2-256(stdin)= 83247e8d9fc4e51551f289a4b351cb2a003d068811987c9701464c093eb1a35a
//
// If this constant ever has to change, THE WIRE FORMAT HAS CHANGED and every
// customer's receiver breaks. That is a breaking change, not a test fix.
const SECRET = "whsec_marvedge_test";
const TIMESTAMP = 1700000000;
const BODY = '{"event":"lead.created","id":"lead_123"}';
const EXPECTED_HEX = "83247e8d9fc4e51551f289a4b351cb2a003d068811987c9701464c093eb1a35a";

describe("signedPayload", () => {
  it("joins the timestamp and the raw body with a dot", () => {
    expect(signedPayload(TIMESTAMP, BODY)).toBe(`1700000000.${BODY}`);
  });

  it("accepts the timestamp as a string, so a header value round-trips", () => {
    expect(signedPayload("1700000000", BODY)).toBe(signedPayload(TIMESTAMP, BODY));
  });
});

describe("signWebhookPayload", () => {
  it("matches the hand-computed fixture", () => {
    expect(signWebhookPayload(SECRET, TIMESTAMP, BODY)).toBe(`${SIGNATURE_PREFIX}${EXPECTED_HEX}`);
  });

  it("changes when the body changes by one character", () => {
    const tampered = signWebhookPayload(SECRET, TIMESTAMP, BODY.replace("lead_123", "lead_124"));
    expect(tampered).not.toBe(`${SIGNATURE_PREFIX}${EXPECTED_HEX}`);
  });

  it("changes when the timestamp changes — a replay cannot reuse a signature", () => {
    expect(signWebhookPayload(SECRET, TIMESTAMP + 1, BODY)).not.toBe(
      `${SIGNATURE_PREFIX}${EXPECTED_HEX}`
    );
  });

  it("changes when the secret changes", () => {
    expect(signWebhookPayload("whsec_other", TIMESTAMP, BODY)).not.toBe(
      `${SIGNATURE_PREFIX}${EXPECTED_HEX}`
    );
  });
});

describe("verifyWebhookSignature", () => {
  it("accepts the signature we produce", () => {
    const signature = signWebhookPayload(SECRET, TIMESTAMP, BODY);
    expect(verifyWebhookSignature(SECRET, TIMESTAMP, BODY, signature)).toBe(true);
  });

  it("accepts the hand-computed fixture verbatim", () => {
    expect(
      verifyWebhookSignature(SECRET, TIMESTAMP, BODY, `${SIGNATURE_PREFIX}${EXPECTED_HEX}`)
    ).toBe(true);
  });

  it("rejects a tampered body, a wrong secret and a shifted timestamp", () => {
    const signature = signWebhookPayload(SECRET, TIMESTAMP, BODY);
    expect(verifyWebhookSignature(SECRET, TIMESTAMP, `${BODY} `, signature)).toBe(false);
    expect(verifyWebhookSignature("whsec_other", TIMESTAMP, BODY, signature)).toBe(false);
    expect(verifyWebhookSignature(SECRET, TIMESTAMP + 60, BODY, signature)).toBe(false);
  });

  it("rejects a malformed candidate without throwing on a length mismatch", () => {
    expect(verifyWebhookSignature(SECRET, TIMESTAMP, BODY, "")).toBe(false);
    expect(verifyWebhookSignature(SECRET, TIMESTAMP, BODY, "sha256=deadbeef")).toBe(false);
    expect(verifyWebhookSignature(SECRET, TIMESTAMP, BODY, EXPECTED_HEX)).toBe(false);
  });
});
