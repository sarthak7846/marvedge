"use client";
import React from "react";
import ReactPlayer from "react-player";
import { toast } from "sonner";
import PreviewControls from "./PreviewControls";

interface PreviewPlayerProps {
  playerRef: React.RefObject<ReactPlayer | null>;
  videoUrl: string;
  playing: boolean;
  volume: number;
  muted: boolean;
  isLoading: boolean;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setDuration: React.Dispatch<React.SetStateAction<number>>;
  duration: number;
  currentTime: number;
  onProgress: (state: { playedSeconds: number }) => void;
  onPlayPause: () => void;
  onSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onMuteToggle: () => void;
  onVolumeChange: (newVolume: number) => void;
  onFullscreen: () => void;
  onEnded: () => void;
}

export default function PreviewPlayer({
  playerRef,
  videoUrl,
  playing,
  volume,
  muted,
  isLoading,
  setIsLoading,
  setDuration,
  duration,
  currentTime,
  onProgress,
  onPlayPause,
  onSeek,
  onMuteToggle,
  onVolumeChange,
  onFullscreen,
  onEnded,
}: PreviewPlayerProps) {
  return (
    <div
      id="video-container"
      className="relative bg-black rounded-2xl overflow-hidden shadow-2xl"
      style={{ aspectRatio: "16/9" }}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      )}

      <ReactPlayer
        ref={playerRef}
        url={videoUrl}
        playing={playing}
        volume={muted ? 0 : volume}
        width="100%"
        height="100%"
        onReady={() => setIsLoading(false)}
        onDuration={setDuration}
        onProgress={onProgress}
        onEnded={onEnded}
        config={{
          file: {
            attributes: {
              crossOrigin: "anonymous",
            },
          },
        }}
        onError={(e) => {
          console.error("Video error:", e);
          toast.error("Error loading video");
        }}
        style={{ objectFit: "contain" }}
      />

      {/* Video Controls Overlay */}
      <PreviewControls
        playing={playing}
        onPlayPause={onPlayPause}
        duration={duration}
        currentTime={currentTime}
        onSeek={onSeek}
        muted={muted}
        volume={volume}
        onMuteToggle={onMuteToggle}
        onVolumeChange={onVolumeChange}
        onFullscreen={onFullscreen}
      />
    </div>
  );
}
