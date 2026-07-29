import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth/options";
import { prisma } from "@/app/lib/prisma";
import { registerCustomDomain, deleteCustomDomain } from "@/app/lib/cloudflare";
import {
  isClaimableSubdomain,
  normalizeSubdomainLabel,
  RESERVED_SUBDOMAINS,
  validateCustomDomain,
} from "@/app/lib/hubDomain";
import { isCustomDomainAllowed } from "@/app/lib/bdh/access";
import { isBdhEnabled } from "@/app/lib/bdh/flags";

/**
 * Hosts next.config.ts allows `next/image` to load from. A logoUrl outside this
 * list makes the public hub page throw at render time, so reject it on write
 * rather than letting one bad save take the whole hub down.
 */
const ALLOWED_LOGO_HOSTS = ["res.cloudinary.com", "lh3.googleusercontent.com"];

function normalizeLogoUrl(value: unknown): { ok: true; url: string | null } | { ok: false } {
  if (value === null || value === undefined || value === "") {
    return { ok: true, url: null };
  }
  if (typeof value !== "string") {
    return { ok: false };
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || !ALLOWED_LOGO_HOSTS.includes(parsed.hostname)) {
      return { ok: false };
    }
    return { ok: true, url: parsed.toString() };
  } catch {
    return { ok: false };
  }
}

/** Hex colours only — the value is injected into the public hub's style scope. */
function normalizeColor(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value.trim())
    ? value.trim().toLowerCase()
    : fallback;
}

/** Deterministic per-user suffix used to disambiguate a taken subdomain. */
function subdomainSuffix(userId: string): string {
  return userId.substring(0, 8);
}

/**
 * Subdomain for a user who has not chosen one.
 *
 * `user-<first 8 of cuid>` is NOT unique on its own: those 8 characters are "c"
 * plus 7 of the 8 base36 timestamp characters, so they only resolve to about
 * 36ms. Two accounts created in the same window generate the same name, and the
 * unique index then turns their first hub load into a 500 that locks them out of
 * the Branding tab entirely. Probe first and add a discriminator on collision.
 */
async function defaultSubdomain(userId: string): Promise<string> {
  const base = `user-${subdomainSuffix(userId)}`;

  for (const candidate of [base, ...Array.from({ length: 5 }, () => `${base}-${randomLabel()}`)]) {
    const taken = await prisma.hubSettings.findFirst({
      where: { subdomain: candidate, NOT: { userId } },
      select: { id: true },
    });
    if (!taken) {
      return candidate;
    }
  }

  // Astronomically unlikely; a fully random name still beats a hard failure.
  return `${base}-${randomLabel()}${randomLabel()}`;
}

function randomLabel(): string {
  return Math.random().toString(36).slice(2, 8);
}

/**
 * Resolve the subdomain a save should land on.
 *
 * A customer gets the clean name they asked for (`acme.marvedge.com`) when it is
 * free — the PRD's sales-leader story is someone reading a URL out loud. Only if
 * it is taken do we fall back to the disambiguated `acme-cmn5tm26` form.
 *
 * An existing subdomain is never changed unless the user actually edited it:
 * their hub URL is already in circulation, and silently rotating it would break
 * every link a prospect has.
 */
async function resolveSubdomain(
  requested: string,
  userId: string,
  current: string | null
): Promise<{ ok: true; subdomain: string } | { ok: false; error: string }> {
  const label = normalizeSubdomainLabel(requested);

  // Nothing usable submitted: keep what they have, or generate a default.
  if (!label) {
    return { ok: true, subdomain: current || (await defaultSubdomain(userId)) };
  }

  // Unchanged — including the case where they re-submitted the suffixed form.
  if (label === current) {
    return { ok: true, subdomain: current };
  }

  if (RESERVED_SUBDOMAINS.has(label)) {
    return { ok: false, error: `"${label}" is reserved. Please choose another subdomain.` };
  }

  const suffixed = `${label}-${subdomainSuffix(userId)}`;
  if (suffixed === current) {
    return { ok: true, subdomain: current };
  }

  const candidates = isClaimableSubdomain(label) ? [label, suffixed] : [suffixed];

  const taken = await prisma.hubSettings.findMany({
    where: { subdomain: { in: candidates }, NOT: { userId } },
    select: { subdomain: true },
  });
  const takenSet = new Set(taken.map((row) => row.subdomain));

  const available = candidates.find((candidate) => !takenSet.has(candidate));
  if (!available) {
    return { ok: false, error: "That subdomain is already in use. Please choose another." };
  }

  return { ok: true, subdomain: available };
}

export async function GET() {
  try {
    if (!isBdhEnabled()) {
      return NextResponse.json({ error: "Demo Hub is not enabled." }, { status: 404 });
    }

    const session = await getServerSession(authOptions);
    if (!session || (!session.user?.id && !session.user?.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ id: session.user.id || undefined }, { email: session.user.email || undefined }],
      },
      include: { hubSettings: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // If hub settings do not exist, create a default hub settings profile.
    // Two tabs opening Settings at once would both try to create one, so treat a
    // lost race as success and return the row the winner wrote.
    if (!user.hubSettings) {
      const settings = await prisma.hubSettings
        .create({
          data: {
            userId: user.id,
            subdomain: await defaultSubdomain(user.id),
            hubTitle: `${user.name || "My"} Product Hub`,
            hubDescription: "Browse all our product interactive tours.",
          },
        })
        .catch(async () => prisma.hubSettings.findUnique({ where: { userId: user.id } }));

      if (!settings) {
        return NextResponse.json({ error: "Failed to create hub settings" }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        settings,
        customDomainAllowed: isCustomDomainAllowed(user.plan),
      });
    }

    // Surfaced in the settings UI: a demo only reaches the hub once it has been
    // shared publicly, which is otherwise invisible to the user.
    const [demoCount, publicDemoCount] = await Promise.all([
      prisma.demo.count({ where: { userId: user.id } }),
      prisma.demo.count({ where: { userId: user.id, isPublic: true } }),
    ]);

    return NextResponse.json({
      success: true,
      settings: user.hubSettings,
      customDomainAllowed: isCustomDomainAllowed(user.plan),
      demoCount,
      publicDemoCount,
    });
  } catch (error) {
    console.error("GET /api/hub error:", error);
    return NextResponse.json({ error: "Failed to fetch hub settings" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isBdhEnabled()) {
      return NextResponse.json({ error: "Demo Hub is not enabled." }, { status: 404 });
    }

    const session = await getServerSession(authOptions);
    if (!session || (!session.user?.id && !session.user?.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ id: session.user.id || undefined }, { email: session.user.email || undefined }],
      },
      include: { hubSettings: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();
    const {
      logoUrl,
      brandColor,
      textColor,
      accentColor,
      hubTitle,
      hubDescription,
      subdomain,
      customDomain,
    } = body;

    const finalSubdomain = await resolveSubdomain(
      typeof subdomain === "string" ? subdomain : "",
      user.id,
      user.hubSettings?.subdomain ?? null
    );

    if (!finalSubdomain.ok) {
      return NextResponse.json({ error: finalSubdomain.error }, { status: 400 });
    }

    // Validate custom domain shape before it reaches Cloudflare
    let cleanCustomDomain: string | null = null;
    if (typeof customDomain === "string" && customDomain.trim()) {
      const validated = validateCustomDomain(customDomain);
      if (!validated.ok) {
        return NextResponse.json({ error: validated.error }, { status: 400 });
      }
      cleanCustomDomain = validated.hostname;
    }

    // Mapping your own domain is the paid, white-label half of the hub; the hub
    // and its Marvedge subdomain stay free. Only gate an actual change, so a
    // lapsed user editing colours doesn't get blocked by their existing domain.
    if (
      cleanCustomDomain !== (user.hubSettings?.customDomain ?? null) &&
      cleanCustomDomain !== null &&
      !isCustomDomainAllowed(user.plan)
    ) {
      return NextResponse.json(
        { error: "Custom domains are available on PRO and ENTERPRISE plans." },
        { status: 403 }
      );
    }

    const logo = normalizeLogoUrl(logoUrl);
    if (!logo.ok) {
      return NextResponse.json(
        { error: "Logo must be an uploaded image URL served over HTTPS." },
        { status: 400 }
      );
    }

    // Validate custom domain uniqueness if changed
    if (cleanCustomDomain && cleanCustomDomain !== user.hubSettings?.customDomain) {
      const existingCustomDomain = await prisma.hubSettings.findUnique({
        where: { customDomain: cleanCustomDomain },
      });
      if (existingCustomDomain) {
        return NextResponse.json({ error: "Custom domain is already in use" }, { status: 400 });
      }
    }

    let cloudflareId = user.hubSettings?.cloudflareId || null;
    let sslStatus = user.hubSettings?.sslStatus || "pending";
    let dnsVerification = user.hubSettings?.dnsVerification || null;

    // If custom domain is updated, trigger Cloudflare API integration
    if (cleanCustomDomain !== (user.hubSettings?.customDomain ?? null)) {
      // 1. Delete previous custom hostname from Cloudflare if it exists. Bail on
      // failure rather than orphaning a hostname that still routes to us.
      if (user.hubSettings?.cloudflareId) {
        const removal = await deleteCustomDomain(user.hubSettings.cloudflareId);
        if (!removal.success) {
          console.error("Cloudflare removal error during save:", removal.error);
          return NextResponse.json(
            { error: `Could not release the previous domain: ${removal.error}` },
            { status: 502 }
          );
        }
      }

      if (cleanCustomDomain) {
        // 2. Register new custom hostname
        const cfResult = await registerCustomDomain(cleanCustomDomain);
        if (cfResult.success) {
          cloudflareId = cfResult.id || null;
          sslStatus = cfResult.sslStatus || "pending";
          dnsVerification = cfResult.dnsVerification || null;
        } else {
          console.error("Cloudflare registration error during save:", cfResult.error);
          return NextResponse.json(
            { error: `Cloudflare configuration failed: ${cfResult.error}` },
            { status: 500 }
          );
        }
      } else {
        cloudflareId = null;
        sslStatus = "pending";
        dnsVerification = null;
      }
    }

    const settingsData = {
      logoUrl: logo.url,
      brandColor: normalizeColor(brandColor, "#7c5cfc"),
      textColor: normalizeColor(textColor, "#111827"),
      accentColor: normalizeColor(accentColor, "#f3f0fc"),
      hubTitle:
        typeof hubTitle === "string" && hubTitle.trim()
          ? hubTitle.trim().slice(0, 120)
          : `${user.name || "My"} Product Hub`,
      hubDescription: typeof hubDescription === "string" ? hubDescription.trim().slice(0, 500) : "",
      subdomain: finalSubdomain.subdomain,
      customDomain: cleanCustomDomain,
      cloudflareId,
      sslStatus,
      dnsVerification: dnsVerification ? JSON.parse(JSON.stringify(dnsVerification)) : null,
    };

    // Update settings
    const updatedSettings = await prisma.hubSettings.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...settingsData },
      update: settingsData,
    });

    return NextResponse.json({ success: true, settings: updatedSettings });
  } catch (error) {
    // The uniqueness probes above are check-then-write, so a concurrent save can
    // still lose the race at the index. Say which field clashed instead of
    // reporting a generic failure the user cannot act on.
    const conflict = uniqueConstraintTarget(error);
    if (conflict) {
      return NextResponse.json(
        {
          error: `That ${conflict === "customDomain" ? "custom domain" : "subdomain"} was just taken. Please choose another.`,
        },
        { status: 409 }
      );
    }

    console.error("POST /api/hub error:", error);
    return NextResponse.json({ error: "Failed to save hub settings" }, { status: 500 });
  }
}

/** Field name behind a Prisma P2002 unique-constraint failure, if that's what this is. */
function uniqueConstraintTarget(error: unknown): "subdomain" | "customDomain" | null {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return null;
  }
  if ((error as { code?: unknown }).code !== "P2002") {
    return null;
  }

  const target = (error as { meta?: { target?: unknown } }).meta?.target;
  const fields = Array.isArray(target) ? target.map(String) : [String(target ?? "")];
  if (fields.some((field) => field.includes("customDomain"))) {
    return "customDomain";
  }
  return "subdomain";
}
