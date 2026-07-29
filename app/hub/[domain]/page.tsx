import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/app/lib/prisma";
import { hubHostname } from "@/app/lib/hubDomain";
import { isBdhEnabled } from "@/app/lib/bdh/flags";
import HubClient from "./HubClient";

type PageProps = {
  params: Promise<{ domain: string }>;
};

/** Max characters of subtitle text shipped per demo for client-side search. */
const SUBTITLE_SEARCH_LIMIT = 2000;

// The hub is white-label: inherit the customer's title/description rather than
// the Marvedge root layout metadata.
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { domain } = await params;

  const settings = await prisma.hubSettings.findFirst({
    where: { OR: [{ subdomain: domain }, { customDomain: domain }] },
    select: {
      hubTitle: true,
      hubDescription: true,
      logoUrl: true,
      subdomain: true,
      customDomain: true,
      user: { select: { name: true } },
    },
  });

  if (!settings) {
    return { title: "Hub not found" };
  }

  const title = settings.hubTitle || `${settings.user.name || "Product"} Demo Hub`;
  const description = settings.hubDescription || `Browse interactive product tours from ${title}.`;

  // The same hub is reachable at its subdomain, its custom domain, and the
  // internal /hub/[key] path. Point search engines at the branded hostname so
  // those don't compete as duplicates.
  const canonical = `https://${hubHostname(settings)}`;

  return {
    title,
    description,
    icons: settings.logoUrl ? { icon: settings.logoUrl } : undefined,
    alternates: { canonical },
    openGraph: { title, description, type: "website", url: canonical },
  };
}

export default async function HubPage({ params }: PageProps) {
  // With the hub switched off, middleware stops rewriting hub hosts here — but
  // /hub/[domain] is still directly reachable on the app domain, so the page has
  // to honour the kill switch itself.
  if (!isBdhEnabled()) {
    notFound();
  }

  const { domain } = await params;

  // Find settings
  const settings = await prisma.hubSettings.findFirst({
    where: {
      OR: [{ subdomain: domain }, { customDomain: domain }],
    },
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  if (!settings) {
    console.warn(
      `[HubPage] Invalid domain or subdomain access: "${domain}". Triggering 404 notFound().`
    );
    notFound();
  }

  // Find all public demos of this user
  const demos = await prisma.demo.findMany({
    where: {
      userId: settings.userId,
      isPublic: true,
    },
    include: {
      // Count views in SQL instead of pulling every view row back.
      _count: { select: { views: true } },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Transform demos to safely extract data fields and count views
  const serializedDemos = demos.map((d) => ({
    id: d.id,
    title: d.title,
    description: d.description,
    videoUrl: d.exportedUrl || d.videoUrl,
    publicLink: d.publicLink,
    createdAt: d.createdAt.toISOString(),
    shareCount: d.shareCount,
    tags: d.tags,
    integrations: d.integrations,
    userRoles: d.userRoles,
    featured: d.featured,
    viewsCount: d._count.views,
    subtitlesText: Array.isArray(d.subtitles)
      ? (d.subtitles as { text?: string }[])
          .map((cue) => cue.text || "")
          .join(" ")
          // Subtitles are only used to seed client-side search (BDH-4.3); cap the
          // per-demo payload so a hub with long transcripts stays lightweight.
          .slice(0, SUBTITLE_SEARCH_LIMIT)
      : "",
  }));

  return (
    <HubClient
      settings={{
        logoUrl: settings.logoUrl,
        brandColor: settings.brandColor,
        textColor: settings.textColor,
        accentColor: settings.accentColor,
        hubTitle: settings.hubTitle || `${settings.user.name || "User"}'s Demo Hub`,
        hubDescription: settings.hubDescription || "",
        subdomain: settings.subdomain || "",
        customDomain: settings.customDomain,
      }}
      demos={serializedDemos}
    />
  );
}
