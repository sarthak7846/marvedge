"use client";

import { useRef } from "react";
import ReactPlayer from "react-player";
import { useVideoPreviewPlayback } from "./video-preview/useVideoPreviewPlayback";
import { useRecordedVideoDuration } from "./video-preview/useRecordedVideoDuration";
import { ScreenStreamVideo, PreviewReactPlayer } from "./video-preview/VideoPreviewSurface";
import {
  PlayOverlayButton,
  VideoPreviewControls,
  VideoPreviewTopBar,
} from "./video-preview/VideoPreviewControls";

interface VideoPreviewProps {
  videoUrl: string | null;
  isRecording?: boolean;
  onTimeChange?: (time: number) => void;
  className?: string;
  screenStream?: MediaStream | null;
  showControls?: boolean;
}

export default function VideoPreview({
  videoUrl,
  isRecording = false,
  onTimeChange,
  className = "",
  screenStream = null,
  showControls = true,
}: VideoPreviewProps) {
  const playerRef = useRef<ReactPlayer>(null!);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    currentTime,
    setCurrentTime,
    duration,
    setDuration,
    playing,
    setPlaying,
    dragging,
    dragValue,
    volume,
    handlePlayPause,
    handleSeekStart,
    handleSeek,
    handleSeekEnd,
    handleFullscreen,
    handleVolumeChange,
  } = useVideoPreviewPlayback({
    isRecording,
    screenStream,
    onTimeChange,
    playerRef,
    videoRef,
    containerRef,
  });

  useRecordedVideoDuration({ videoUrl, screenStream, videoRef, playerRef, setDuration });

  return (
    <div
      ref={containerRef}
      className={`relative w-full max-w-[400px] h-[260px] sm:w-full sm:max-w-[900px] sm:h-auto sm:aspect-video bg-white rounded-2xl shadow-md flex flex-col items-center justify-center transition-all duration-300 ${className}`}
      style={{
        minHeight: "160px",
        padding: 0,
        boxShadow: "0 4px 24px 0 #E6E1FA",
      }}
    >
      {/* Video Player */}
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          zIndex: 1,
          borderRadius: "1.25rem",
          overflow: "hidden",
          background: "#F6F3FF",
        }}
      >
        {/* Top Control Bar - Only show when not recording */}
        {!isRecording && (
          <VideoPreviewTopBar
            volume={volume}
            onVolumeChange={handleVolumeChange}
            onFullscreen={handleFullscreen}
          />
        )}
        {/* Play/Pause Button Overlay - Only show when not recording and video is paused */}
        {!isRecording && !playing && <PlayOverlayButton onClick={handlePlayPause} />}
        {screenStream ? (
          <ScreenStreamVideo
            videoRef={videoRef}
            isRecording={isRecording}
            setDuration={setDuration}
            setCurrentTime={setCurrentTime}
            onTimeChange={onTimeChange}
          />
        ) : (
          <PreviewReactPlayer
            playerRef={playerRef}
            videoUrl={videoUrl}
            playing={playing}
            setPlaying={setPlaying}
            isRecording={isRecording}
            volume={volume}
            duration={duration}
            setDuration={setDuration}
            setCurrentTime={setCurrentTime}
            onTimeChange={onTimeChange}
          />
        )}
      </div>

      {/* Custom Video Controls */}
      {showControls && (
        <VideoPreviewControls
          playing={playing}
          isRecording={isRecording}
          currentTime={currentTime}
          duration={duration}
          dragging={dragging}
          dragValue={dragValue}
          screenStream={screenStream}
          videoRef={videoRef}
          playerRef={playerRef}
          setCurrentTime={setCurrentTime}
          onTimeChange={onTimeChange}
          onPlayPause={handlePlayPause}
          onSeekStart={handleSeekStart}
          onSeek={handleSeek}
          onSeekEnd={handleSeekEnd}
        />
      )}
    </div>
  );
}
