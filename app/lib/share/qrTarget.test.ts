import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  DEFAULT_ROOT_DOMAIN,
  QR_SOURCE_PARAM,
  QR_SOURCE_VALUE,
  hubShareUrl,
  qrViewSource,
  toMarvedgeShareUrl,
  withQrSource,
} from "./qrTarget";

// The allowlist reads env at call time, so each test sets the deployment it means
// rather than inheriting whatever the runner happened to have.
const ENV_KEYS = ["NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_ROOT_DOMAIN", "NODE_ENV"] as const;
const saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

/** Assign through the index signature — NODE_ENV is a readonly literal in TS. */
function setEnv(key: (typeof ENV_KEYS)[number], value: string | undefined): void {
  if (value === undefined) {
    delete (process.env as Record<string, string | undefined>)[key];
  } else {
    (process.env as Record<string, string | undefined>)[key] = value;
  }
}

/** The shape of production: real app URL, real root domain, NODE_ENV=production. */
function asProduction(): void {
  setEnv("NEXT_PUBLIC_APP_URL", `https://${DEFAULT_ROOT_DOMAIN}`);
  setEnv("NEXT_PUBLIC_ROOT_DOMAIN", DEFAULT_ROOT_DOMAIN);
  setEnv("NODE_ENV", "production");
}

beforeEach(() => {
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    setEnv(key, saved[key]);
  }
});

describe("toMarvedgeShareUrl — origin allowlist", () => {
  beforeEach(asProduction);

  it("accepts a share URL on the configured app origin", () => {
    expect(toMarvedgeShareUrl(`https://${DEFAULT_ROOT_DOMAIN}/share/abc123`)).toBe(
      `https://${DEFAULT_ROOT_DOMAIN}/share/abc123`
    );
  });

  it("accepts the exported-video share path and www", () => {
    expect(toMarvedgeShareUrl(`https://${DEFAULT_ROOT_DOMAIN}/share/video/vid_1`)).toBeDefined();
    expect(toMarvedgeShareUrl(`https://www.${DEFAULT_ROOT_DOMAIN}/share/abc`)).toBeDefined();
  });

  it("accepts a hub subdomain of the root domain", () => {
    expect(toMarvedgeShareUrl(`https://acme.${DEFAULT_ROOT_DOMAIN}/share/abc`)).toBeDefined();
  });

  it("accepts a custom hub domain only when it is the requesting host", () => {
    const url = "https://demos.acme.com/share/abc";
    expect(toMarvedgeShareUrl(url, { requestHost: "demos.acme.com" })).toBeDefined();
    // The same URL requested from marvedge.com — which is what a victim's browser
    // would send for an embedded https://marvedge.com/api/qr?url=... — is refused.
    expect(toMarvedgeShareUrl(url, { requestHost: DEFAULT_ROOT_DOMAIN })).toBeUndefined();
    expect(toMarvedgeShareUrl(url)).toBeUndefined();
  });

  it("rejects an off-origin https URL", () => {
    expect(toMarvedgeShareUrl("https://evil.example/share/abc")).toBeUndefined();
  });

  it("rejects look-alike hosts rather than substring-matching the root domain", () => {
    for (const host of [
      `${DEFAULT_ROOT_DOMAIN}.evil.example`,
      `evil-${DEFAULT_ROOT_DOMAIN}`,
      `${DEFAULT_ROOT_DOMAIN}evil.com`,
      `not${DEFAULT_ROOT_DOMAIN}`,
    ]) {
      expect(toMarvedgeShareUrl(`https://${host}/share/abc`), host).toBeUndefined();
    }
  });

  it("rejects a URL whose credentials dress it up as ours", () => {
    expect(
      toMarvedgeShareUrl(`https://${DEFAULT_ROOT_DOMAIN}@evil.example/share/abc`)
    ).toBeUndefined();
    expect(toMarvedgeShareUrl(`https://user:pw@${DEFAULT_ROOT_DOMAIN}/share/abc`)).toBeUndefined();
  });

  it("rejects non-http(s) schemes", () => {
    for (const url of [
      "javascript:alert(1)",
      `javascript:fetch("https://${DEFAULT_ROOT_DOMAIN}/share/a")`,
      "data:text/html,<script>alert(1)</script>",
      "file:///etc/passwd",
    ]) {
      expect(toMarvedgeShareUrl(url), url).toBeUndefined();
    }
  });

  it("rejects junk and non-strings", () => {
    for (const value of ["", "   ", "not a url", null, undefined, 42, {}, []]) {
      expect(toMarvedgeShareUrl(value), JSON.stringify(value)).toBeUndefined();
    }
  });

  it("rejects localhost on a production deployment", () => {
    expect(toMarvedgeShareUrl("http://localhost:3000/share/abc")).toBeUndefined();
  });

  it("accepts localhost off production, so dev works without extra config", () => {
    setEnv("NODE_ENV", "development");
    expect(toMarvedgeShareUrl("http://localhost:3000/share/abc")).toBeDefined();
    expect(toMarvedgeShareUrl("http://127.0.0.1:3000/share/abc")).toBeDefined();
  });
});

describe("toMarvedgeShareUrl — path shape", () => {
  beforeEach(asProduction);

  it("accepts the three share paths the product serves", () => {
    for (const path of ["/share/abc", "/share/video/v1", "/hub/acme/share/abc", "/share/abc/"]) {
      expect(toMarvedgeShareUrl(`https://${DEFAULT_ROOT_DOMAIN}${path}`), path).toBeDefined();
    }
  });

  it("refuses to brand a non-share page on an origin we own", () => {
    // The origin passes; the path does not. Without this, /api/qr would mint a
    // Marvedge-branded QR for the login page or a password reset link.
    for (const path of ["/", "/dashboard", "/auth/signin", "/settings/billing", "/share"]) {
      expect(toMarvedgeShareUrl(`https://${DEFAULT_ROOT_DOMAIN}${path}`), path).toBeUndefined();
    }
  });
});

describe("withQrSource", () => {
  it("tags the URL as the QR copy", () => {
    expect(withQrSource("https://marvedge.com/share/abc")).toBe(
      `https://marvedge.com/share/abc?${QR_SOURCE_PARAM}=${QR_SOURCE_VALUE}`
    );
  });

  it("is idempotent, so a double pass cannot produce src=qr&src=qr", () => {
    const once = withQrSource("https://marvedge.com/share/abc");
    expect(withQrSource(once)).toBe(once);
  });

  it("preserves existing query params and the fragment", () => {
    const tagged = withQrSource("https://marvedge.com/share/abc?utm_source=email#top");
    expect(tagged).toContain("utm_source=email");
    expect(tagged).toContain(`${QR_SOURCE_PARAM}=${QR_SOURCE_VALUE}`);
    expect(tagged.endsWith("#top")).toBe(true);
  });

  it("returns an unparseable input untouched rather than guessing", () => {
    expect(withQrSource("not a url")).toBe("not a url");
  });
});

describe("qrViewSource", () => {
  it("reads the tag a scan arrives with", () => {
    expect(qrViewSource("?src=qr")).toBe(QR_SOURCE_VALUE);
    expect(qrViewSource("?utm_source=email&src=qr")).toBe(QR_SOURCE_VALUE);
  });

  it("is undefined for a plain link click", () => {
    for (const search of ["", "?", "?utm_source=email", null, undefined]) {
      expect(qrViewSource(search), String(search)).toBeUndefined();
    }
  });

  it("never echoes an arbitrary value back to the caller", () => {
    // Whatever src says, the only thing that leaves here is "qr" or nothing —
    // this value ends up in a log line.
    expect(qrViewSource("?src=qr%0aINJECTED")).toBeUndefined();
    expect(qrViewSource("?src=email")).toBeUndefined();
  });
});

describe("hubShareUrl", () => {
  it("encodes the customer's own domain, not marvedge.com", () => {
    setEnv("NEXT_PUBLIC_APP_URL", `https://${DEFAULT_ROOT_DOMAIN}`);
    expect(hubShareUrl("demos.acme.com", "abc")).toBe("https://demos.acme.com/share/abc");
  });

  it("keeps the port and drops to http for a local hub", () => {
    expect(hubShareUrl("acme.localhost:3000", "abc")).toBe("http://acme.localhost:3000/share/abc");
  });

  it("produces a URL the QR endpoint will accept from that same host", () => {
    asProduction();
    const url = hubShareUrl("demos.acme.com", "abc");
    expect(toMarvedgeShareUrl(url, { requestHost: "demos.acme.com" })).toBe(url);
  });

  it("is undefined when there is no usable host or slug", () => {
    expect(hubShareUrl(null, "abc")).toBeUndefined();
    expect(hubShareUrl("", "abc")).toBeUndefined();
    expect(hubShareUrl("demos.acme.com", "")).toBeUndefined();
  });
});
