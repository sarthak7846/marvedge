/**
 * Single source of truth for the domains the Branded Demo Hub is served from.
 *
 * The middleware, the settings UI and the public hub all need to agree on which
 * hostnames are "the app" and which are a customer hub, so every one of them
 * reads from here instead of hard-coding a domain.
 *
 * - NEXT_PUBLIC_ROOT_DOMAIN      apex the app itself is served from.
 * - NEXT_PUBLIC_HUB_ROOT_DOMAIN  apex customer hub subdomains hang off
 *                                (`acme-cmn5tm26.<hub root>`). Defaults to the
 *                                app root, so a single-domain deploy needs no
 *                                extra configuration.
 * - NEXT_PUBLIC_HUB_CNAME_TARGET record customers point their CNAME at.
 */
export const ROOT_DOMAIN = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || "marvedge.com").toLowerCase();

export const HUB_ROOT_DOMAIN = (
  process.env.NEXT_PUBLIC_HUB_ROOT_DOMAIN || ROOT_DOMAIN
).toLowerCase();

export const HUB_CNAME_TARGET = (
  process.env.NEXT_PUBLIC_HUB_CNAME_TARGET || "hub-ingress.marvedge.io"
).toLowerCase();

/** Apexes whose single-label subdomains resolve to a hub. */
const HUB_APEXES = Array.from(new Set([ROOT_DOMAIN, HUB_ROOT_DOMAIN]));

/** Hostnames that are always the app itself, never a hub. */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "[::1]", "::1"]);

export type HubHost =
  /** The app itself — render the normal marketing/app routes. */
  | { kind: "main"; domainKey: null }
  /** `acme-cmn5tm26.marvedge.com` — key is the subdomain label. */
  | { kind: "subdomain"; domainKey: string }
  /** `demos.mycompany.com` — key is the full hostname. */
  | { kind: "custom"; domainKey: string };

const MAIN: HubHost = { kind: "main", domainKey: null };

/**
 * Drop the port from a Host header value. Handles bracketed IPv6 literals
 * (`[::1]:3000`) so local development on any port resolves the same way.
 */
export function stripPort(host: string): string {
  if (host.startsWith("[")) {
    const close = host.indexOf("]");
    return close === -1 ? host : host.slice(0, close + 1);
  }
  const colon = host.indexOf(":");
  return colon === -1 ? host : host.slice(0, colon);
}

/**
 * Decide whether an incoming Host header is the app, a hub subdomain, or a
 * mapped custom domain. Anything ambiguous falls back to "main" so an
 * unexpected host degrades to the normal app rather than a 404 hub.
 */
export function classifyHost(rawHost: string): HubHost {
  const host = stripPort(rawHost).trim().toLowerCase();
  if (!host) {
    return MAIN;
  }

  // Local dev and Vercel production/preview deployments are always the app.
  if (LOCAL_HOSTS.has(host) || host.endsWith(".vercel.app")) {
    return MAIN;
  }

  // `acme.localhost:3000` — lets subdomain routing be exercised locally.
  if (host.endsWith(".localhost")) {
    const key = host.slice(0, -".localhost".length);
    return key && key !== "www" && !key.includes(".")
      ? { kind: "subdomain", domainKey: key }
      : MAIN;
  }

  for (const apex of HUB_APEXES) {
    if (host === apex || host === `www.${apex}`) {
      return MAIN;
    }
    if (host.endsWith(`.${apex}`)) {
      const key = host.slice(0, host.length - apex.length - 1);
      // Only single-label subdomains are hub keys; deeper hosts are not hubs.
      return key && !key.includes(".") ? { kind: "subdomain", domainKey: key } : MAIN;
    }
  }

  return { kind: "custom", domainKey: host };
}

/**
 * Origin to send a visitor back to when they hit an app-only route (dashboard,
 * auth) on a hub host. Preserves the local port so dev redirects don't dead-end.
 */
export function mainAppOrigin(rawHost: string): string {
  const host = stripPort(rawHost).toLowerCase();
  if (LOCAL_HOSTS.has(host) || host.endsWith(".localhost")) {
    const colon = rawHost.lastIndexOf(":");
    const port = colon > rawHost.lastIndexOf("]") ? rawHost.slice(colon) : "";
    return `http://localhost${port}`;
  }
  return `https://${ROOT_DOMAIN}`;
}

/** Public hostname a hub is reachable at, for display in the UI. */
export function hubHostname(settings: {
  subdomain?: string | null;
  customDomain?: string | null;
}): string {
  if (settings.customDomain) {
    return settings.customDomain;
  }
  return settings.subdomain ? `${settings.subdomain}.${HUB_ROOT_DOMAIN}` : HUB_ROOT_DOMAIN;
}

/**
 * Subdomains a customer may not claim: platform hostnames, the routing gateway,
 * and the usual infrastructure names. Claiming any of these would shadow a real
 * host or let a tenant impersonate Marvedge itself.
 */
export const RESERVED_SUBDOMAINS = new Set([
  "admin",
  "api",
  "app",
  "assets",
  "auth",
  "blog",
  "cdn",
  "dashboard",
  "demo",
  "demos",
  "dev",
  "docs",
  "ftp",
  "help",
  "hub",
  "hub-ingress",
  "internal",
  "localhost",
  "login",
  "mail",
  "marvedge",
  "ns1",
  "ns2",
  "preview",
  "public",
  "root",
  "settings",
  "share",
  "smtp",
  "staging",
  "static",
  "status",
  "support",
  "test",
  "user",
  "webmail",
  "www",
]);

/**
 * Normalize a user-supplied subdomain into a legal DNS label. Returns null when
 * nothing usable survives, so the caller can fall back to a generated name.
 */
export function normalizeSubdomainLabel(input: string): string | null {
  const label = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63)
    .replace(/-+$/g, "");

  return label || null;
}

/**
 * Whether a normalized label may be claimed as-is. Reserved names and labels
 * short enough to be confusable are pushed to the suffixed form instead.
 */
export function isClaimableSubdomain(label: string): boolean {
  return label.length >= 3 && !RESERVED_SUBDOMAINS.has(label);
}

// Labels: 1-63 chars, alphanumeric or hyphen, no leading/trailing hyphen.
const HOSTNAME_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;

/**
 * Validate a customer-supplied custom domain before it is handed to Cloudflare.
 * Rejects malformed hostnames and any host under a domain we control, which
 * Cloudflare cannot issue a custom hostname for and which would otherwise let a
 * tenant squat a platform hostname.
 */
export function validateCustomDomain(
  input: string
): { ok: true; hostname: string } | { ok: false; error: string } {
  const hostname = stripPort(input.trim().toLowerCase()).replace(/\.$/, "");

  if (!hostname) {
    return { ok: false, error: "Custom domain is required" };
  }
  if (hostname.length > 253) {
    return { ok: false, error: "Custom domain is too long" };
  }
  if (!HOSTNAME_RE.test(hostname)) {
    return {
      ok: false,
      error: "Enter a valid domain such as demos.mycompany.com (no protocol, path or port)",
    };
  }

  const reserved = [...HUB_APEXES, "localhost", "vercel.app"];
  if (reserved.some((apex) => hostname === apex || hostname.endsWith(`.${apex}`))) {
    return {
      ok: false,
      error: `${hostname} is a Marvedge-managed domain. Use your Marvedge subdomain instead, or enter a domain you own.`,
    };
  }

  return { ok: true, hostname };
}
