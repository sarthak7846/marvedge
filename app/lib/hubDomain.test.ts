import { describe, expect, it } from "vitest";

import {
  classifyHost,
  hubHostname,
  isClaimableSubdomain,
  mainAppOrigin,
  normalizeSubdomainLabel,
  stripPort,
  validateCustomDomain,
} from "./hubDomain";

// These tests pin the default configuration (NEXT_PUBLIC_ROOT_DOMAIN unset ->
// "marvedge.com"). The classification is load-bearing: misrouting the app's own
// apex rewrites every page to a hub and takes the whole site down.

describe("stripPort", () => {
  it("removes the port from host headers", () => {
    expect(stripPort("localhost:3000")).toBe("localhost");
    expect(stripPort("demos.mycompany.com")).toBe("demos.mycompany.com");
  });

  it("keeps bracketed IPv6 literals intact", () => {
    expect(stripPort("[::1]:3000")).toBe("[::1]");
  });
});

describe("classifyHost", () => {
  it("treats the app's own domain as main", () => {
    expect(classifyHost("marvedge.com").kind).toBe("main");
    expect(classifyHost("www.marvedge.com").kind).toBe("main");
    expect(classifyHost("MARVEDGE.COM").kind).toBe("main");
  });

  it("treats dev and Vercel hosts as main on any port", () => {
    expect(classifyHost("localhost:3000").kind).toBe("main");
    expect(classifyHost("localhost:3001").kind).toBe("main");
    expect(classifyHost("127.0.0.1:3000").kind).toBe("main");
    expect(classifyHost("marvedge.vercel.app").kind).toBe("main");
    expect(classifyHost("marvedge-git-feature-x.vercel.app").kind).toBe("main");
  });

  it("maps a hub subdomain to its label", () => {
    expect(classifyHost("acme-cmn5tm26.marvedge.com")).toEqual({
      kind: "subdomain",
      domainKey: "acme-cmn5tm26",
    });
  });

  it("supports subdomain routing locally on any port", () => {
    expect(classifyHost("acme-cmn5tm26.localhost:3000")).toEqual({
      kind: "subdomain",
      domainKey: "acme-cmn5tm26",
    });
  });

  it("maps a mapped custom domain to its full hostname, without the port", () => {
    expect(classifyHost("demos.mycompany.com")).toEqual({
      kind: "custom",
      domainKey: "demos.mycompany.com",
    });
    expect(classifyHost("demos.mycompany.com:3000")).toEqual({
      kind: "custom",
      domainKey: "demos.mycompany.com",
    });
  });

  it("falls back to the app rather than hijacking ambiguous hosts", () => {
    // Multi-label subdomains are not hub keys.
    expect(classifyHost("a.b.marvedge.com").kind).toBe("main");
    expect(classifyHost("").kind).toBe("main");
  });
});

describe("mainAppOrigin", () => {
  it("preserves the local port so dev redirects do not dead-end", () => {
    expect(mainAppOrigin("acme.localhost:3001")).toBe("http://localhost:3001");
  });

  it("sends hub visitors back to the app apex over https", () => {
    expect(mainAppOrigin("demos.mycompany.com")).toBe("https://marvedge.com");
  });
});

describe("validateCustomDomain", () => {
  it("accepts a normal delegated hostname", () => {
    expect(validateCustomDomain("  Demos.MyCompany.com ")).toEqual({
      ok: true,
      hostname: "demos.mycompany.com",
    });
  });

  it("strips a trailing dot and any port", () => {
    expect(validateCustomDomain("demos.mycompany.com.")).toEqual({
      ok: true,
      hostname: "demos.mycompany.com",
    });
  });

  it("rejects malformed input before it reaches Cloudflare", () => {
    for (const bad of [
      "",
      "notadomain",
      "https://demos.mycompany.com",
      "demos.mycompany.com/path",
      "has space.com",
      "-leadinghyphen.com",
    ]) {
      expect(validateCustomDomain(bad).ok, bad).toBe(false);
    }
  });

  it("rejects domains we control, which cannot be Cloudflare custom hostnames", () => {
    expect(validateCustomDomain("marvedge.com").ok).toBe(false);
    expect(validateCustomDomain("acme.marvedge.com").ok).toBe(false);
    expect(validateCustomDomain("evil.vercel.app").ok).toBe(false);
  });
});

describe("normalizeSubdomainLabel", () => {
  it("lowercases and strips characters illegal in a DNS label", () => {
    expect(normalizeSubdomainLabel("  Acme Corp!  ")).toBe("acmecorp");
    expect(normalizeSubdomainLabel("my-company")).toBe("my-company");
  });

  it("trims leading and trailing hyphens", () => {
    expect(normalizeSubdomainLabel("--acme--")).toBe("acme");
  });

  it("caps the label at the 63-character DNS limit without a trailing hyphen", () => {
    const label = normalizeSubdomainLabel("a".repeat(70));
    expect(label).toHaveLength(63);

    const hyphenated = normalizeSubdomainLabel(`${"a".repeat(62)}-extra`);
    expect(hyphenated?.endsWith("-")).toBe(false);
  });

  it("returns null when nothing usable survives", () => {
    expect(normalizeSubdomainLabel("!!!")).toBeNull();
    expect(normalizeSubdomainLabel("   ")).toBeNull();
  });
});

describe("isClaimableSubdomain", () => {
  it("allows ordinary names", () => {
    expect(isClaimableSubdomain("acme")).toBe(true);
  });

  it("refuses reserved platform names", () => {
    for (const reserved of ["www", "api", "admin", "hub", "marvedge", "hub-ingress"]) {
      expect(isClaimableSubdomain(reserved), reserved).toBe(false);
    }
  });

  it("refuses names too short to be distinctive", () => {
    expect(isClaimableSubdomain("ab")).toBe(false);
  });
});

describe("hubHostname", () => {
  it("prefers the custom domain when one is mapped", () => {
    expect(hubHostname({ subdomain: "acme", customDomain: "demos.mycompany.com" })).toBe(
      "demos.mycompany.com"
    );
  });

  it("falls back to the Marvedge subdomain", () => {
    expect(hubHostname({ subdomain: "acme", customDomain: null })).toBe("acme.marvedge.com");
  });
});
