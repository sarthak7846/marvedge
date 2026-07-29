import { afterEach, describe, expect, it } from "vitest";

import { isBdhEnabled, isBdhRoutingEnabled } from "./flags";
import { isCustomDomainAllowed } from "./access";

const original = {
  server: process.env.BDH_ENABLED,
  client: process.env.NEXT_PUBLIC_BDH_ENABLED,
};

afterEach(() => {
  process.env.BDH_ENABLED = original.server;
  process.env.NEXT_PUBLIC_BDH_ENABLED = original.client;
});

// BDH is opt-OUT, the reverse of AVS/WTM: it already ships enabled, so an unset
// variable must keep it on. Getting this backwards silently disables a live
// feature on the next deploy.
describe("BDH flags", () => {
  it("stays enabled when unset", () => {
    delete process.env.BDH_ENABLED;
    delete process.env.NEXT_PUBLIC_BDH_ENABLED;
    expect(isBdhEnabled()).toBe(true);
    expect(isBdhRoutingEnabled()).toBe(true);
  });

  it("stays enabled for any value that is not an explicit off switch", () => {
    process.env.BDH_ENABLED = "true";
    expect(isBdhEnabled()).toBe(true);

    process.env.BDH_ENABLED = "";
    expect(isBdhEnabled()).toBe(true);
  });

  it("disables only on an explicit false or 0", () => {
    process.env.BDH_ENABLED = "false";
    expect(isBdhEnabled()).toBe(false);

    process.env.BDH_ENABLED = "0";
    expect(isBdhEnabled()).toBe(false);

    process.env.NEXT_PUBLIC_BDH_ENABLED = "false";
    expect(isBdhRoutingEnabled()).toBe(false);
  });
});

describe("isCustomDomainAllowed", () => {
  it("allows paid plans", () => {
    expect(isCustomDomainAllowed("PRO")).toBe(true);
    expect(isCustomDomainAllowed("ENTERPRISE")).toBe(true);
  });

  it("refuses free and unknown plans", () => {
    expect(isCustomDomainAllowed("FREE")).toBe(false);
    expect(isCustomDomainAllowed(null)).toBe(false);
    expect(isCustomDomainAllowed(undefined)).toBe(false);
    expect(isCustomDomainAllowed("pro")).toBe(false);
  });
});
