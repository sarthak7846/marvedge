"use client";
import { useRouter } from "next/navigation";
import { usePreviewPlayer } from "./hooks/usePreviewPlayer";
import PreviewHeader from "./components/PreviewHeader";
import PreviewPlayer from "./components/PreviewPlayer";
import PreviewInfo from "./components/PreviewInfo";
import NoVideoFound from "./components/NoVideoFound";

export default function PreviewPage() {
  const router = useRouter();
  const player = usePreviewPlayer();

  if (!player.videoUrl) {
    return <NoVideoFound onGoHome={() => router.push("/")} />;
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-purple-50 to-indigo-100">
      {/* Header */}
      <PreviewHeader
        onBack={() => router.back()}
        onShare={player.handleShare}
        downloadOpen={player.downloadOpen}
        setDownloadOpen={player.setDownloadOpen}
        onDownloadFile={player.handleDownloadFile}
        title={player.title}
        exportMenuOpen={player.exportMenuOpen}
        setExportMenuOpen={player.setExportMenuOpen}
        onDownload={player.handleDownload}
      />

      {/* Video Player */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PreviewPlayer
          playerRef={player.playerRef}
          videoUrl={player.videoUrl}
          playing={player.playing}
          volume={player.volume}
          muted={player.muted}
          isLoading={player.isLoading}
          setIsLoading={player.setIsLoading}
          setDuration={player.setDuration}
          duration={player.duration}
          currentTime={player.currentTime}
          onProgress={player.handleProgress}
          onPlayPause={player.handlePlayPause}
          onSeek={player.handleSeek}
          onMuteToggle={player.handleMuteToggle}
          onVolumeChange={player.handleVolumeChange}
          onFullscreen={player.handleFullscreen}
        />

        {/* Video Info */}
        <PreviewInfo
          title={player.title}
          description={player.description}
          duration={player.duration}
          videoUrl={player.videoUrl}
        />
      </div>
    </div>
  );
}
