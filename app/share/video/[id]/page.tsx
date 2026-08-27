import { notFound } from "next/navigation";
import { prisma } from "@/app/lib/prisma";
import ShareVideoPageClient from "../../[slug]/ShareVideoPageClient";
import { resolveShareOverlays } from "../../[slug]/overlayContext";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function SharedExportedVideoPage({ params }: PageProps) {
  const { id } = await params;
  const video = await prisma.exportedVideo.findUnique({
    where: { id },
    select: {
      demoId: true,
      title: true,
      description: true,
      exportedUrl: true,
    },
  });

  if (!video) {
    notFound();
  }

  // An export that was never attached to a demo has no overlay config and no
  // demo to hang a Lead off, so this resolves to undefined and the page renders
  // exactly as it does today.
  const overlayContext = await resolveShareOverlays(video.demoId ?? undefined);

  return (
    <ShareVideoPageClient
      title={video.title}
      description={video.description}
      videoUrl={video.exportedUrl || ""}
      backgroundStyle={{}}
      aspectRatio="native"
      videoId={id}
      demoId={video.demoId ?? undefined}
      overlays={overlayContext?.overlays}
      ownerName={overlayContext?.ownerName}
      leadCaptured={overlayContext?.leadCaptured}
    />
  );
}
