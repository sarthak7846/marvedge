import { notFound } from "next/navigation";
import { prisma } from "@/app/lib/prisma";
import HubClient from "./HubClient";
import { cuesToSearchText } from "@/app/lib/subtitles";

type PageProps = {
  params: Promise<{ domain: string }>;
};

export default async function HubPage({ params }: PageProps) {
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
      `[HubPage] Invalid domain: "${domain}". Triggering 404 notFound().`
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
      views: {
        select: { id: true },
      },
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
    viewsCount: d.views.length,
    // Tolerates both shapes the column has been written in: the bare cue array
    // written now, and the legacy `{ provider, language, cues }` wrapper. The
    // inline `Array.isArray` this replaces was always false against the wrapper,
    // so hub subtitle search silently matched nothing.
    subtitlesText: cuesToSearchText(d.subtitles),
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
