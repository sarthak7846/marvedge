import { notFound } from "next/navigation";
import { prisma } from "@/app/lib/prisma";
import HubClient from "./HubClient";

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
          image: true,
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
    subtitlesText: Array.isArray(d.subtitles)
      ? (d.subtitles as { text?: string }[]).map((cue) => cue.text || "").join(" ")
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
      user={{ name: settings.user.name, image: settings.user.image }}
      demos={serializedDemos}
    />
  );
}
