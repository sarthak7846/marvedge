import Image from "next/image";
import ReactPlayer from "react-player";
import { formatTime } from "@/app/lib/dateTimeUtils";

interface VideoPreviewTopBarProps {
  volume: number;
  onVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFullscreen: () => void;
}

export function VideoPreviewTopBar({
  volume,
  onVolumeChange,
  onFullscreen,
}: VideoPreviewTopBarProps) {
  return (
    <div className="absolute top-0 right-0 z-20 flex items-center gap-2 p-4 bg-linear-to-l from-black/60 to-transparent rounded-bl-2xl">
      {/* Volume Control */}
      <div className="flex items-center gap-2 bg-black/40 rounded-full px-3 py-2 backdrop-blur-sm">
        <Image src="/icons/volume.svg" alt="volume" width={18} height={18} />
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={volume}
          onChange={onVolumeChange}
          className="w-20 h-1 accent-[#7C5CFC]"
          style={{ cursor: "pointer" }}
        />
      </div>

      {/* Fullscreen Button */}
      <button
        onClick={onFullscreen}
        className="bg-black/40 hover:bg-black/60 text-white rounded-full p-2 transition backdrop-blur-sm"
      >
        <Image src="/icons/fullscreen.svg" alt="fullscreen" width={20} height={20} />
      </button>
    </div>
  );
}

interface PlayOverlayButtonProps {
  onClick: () => void;
}

export function PlayOverlayButton({ onClick }: PlayOverlayButtonProps) {
  return (
    <button
      onClick={onClick}
      className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 rounded-full bg-black/50 hover:bg-black/70 text-white p-2 transition-all duration-200"
      style={{
        backdropFilter: "blur(4px)",
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M8 5V19L19 12L8 5Z" fill="currentColor" />
      </svg>
    </button>
  );
}

interface VideoPreviewControlsProps {
  playing: boolean;
  isRecording: boolean;
  currentTime: number;
  duration: number;
  dragging: boolean;
  dragValue: number;
  screenStream: MediaStream | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  playerRef: React.RefObject<ReactPlayer>;
  setCurrentTime: (time: number) => void;
  onTimeChange?: (time: number) => void;
  onPlayPause: () => void;
  onSeekStart: () => void;
  onSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSeekEnd: (e: React.PointerEvent<HTMLInputElement>) => void;
}

export function VideoPreviewControls({
  playing,
  isRecording,
  currentTime,
  duration,
  dragging,
  dragValue,
  screenStream,
  videoRef,
  playerRef,
  setCurrentTime,
  onTimeChange,
  onPlayPause,
  onSeekStart,
  onSeek,
  onSeekEnd,
}: VideoPreviewControlsProps) {
  const skipBackward = () => {
    if (isRecording) {
      return;
    }
    const newTime = Math.max(0, currentTime - 5);
    setCurrentTime(newTime);
    if (screenStream && videoRef.current) {
      videoRef.current.currentTime = newTime;
    } else {
      playerRef.current?.seekTo(newTime, "seconds");
    }
    onTimeChange?.(newTime);
  };

  const skipForward = () => {
    if (isRecording) {
      return;
    }
    const newTime = Math.min(duration, currentTime + 5);
    setCurrentTime(newTime);
    if (screenStream && videoRef.current) {
      videoRef.current.currentTime = newTime;
    } else {
      playerRef.current?.seekTo(newTime, "seconds");
    }
    onTimeChange?.(newTime);
  };

  return (
    <div className="w-full px-6 pb-4 pt-2 flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <button
          onClick={onPlayPause}
          disabled={isRecording}
          className="rounded-full bg-[#E6E1FA] text-[#7C5CFC] hover:bg-[#7C5CFC] hover:text-white p-2 transition disabled:opacity-50"
        >
          {playing ? (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect x="3" y="3" width="4" height="12" rx="2" fill="currentColor" />
              <rect x="11" y="3" width="4" height="12" rx="2" fill="currentColor" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4 3V15L15 9L4 3Z" fill="currentColor" />
            </svg>
          )}
        </button>
        <input
          type="range"
          min={0}
          max={duration}
          step={0.01}
          value={dragging ? dragValue : currentTime}
          onPointerDown={onSeekStart}
          onChange={onSeek}
          onPointerUp={onSeekEnd}
          disabled={isRecording}
          className="flex-1 accent-[#A594F9] h-2 rounded-lg bg-linear-to-r from-[#A594F9] to-[#7C5CFC] disabled:opacity-50"
          style={{
            background: "linear-gradient(90deg, #A594F9 0%, #7C5CFC 100%)",
            height: 8,
            borderRadius: 8,
          }}
        />
        <span className="text-xs text-[#A594F9] font-mono min-w-[60px] text-right">
          {formatTime(currentTime)} / {duration > 0 ? formatTime(duration) : "0:00"}
        </span>
      </div>

      {/* 5-second skip buttons */}
      <div className="flex items-center justify-between mt-2 px-2 w-full">
        <div className="flex items-center gap-2">
          <button
            onClick={skipBackward}
            disabled={isRecording}
            className="rounded-full bg-[#7C5CFC] text-white hover:bg-[#6356D7] p-1.5 transition disabled:opacity-50 shadow-sm"
            title="Back 5 seconds"
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 20 20">
              <path
                d="M10 2v2.06A8 8 0 1 0 18 10"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M7 9l-3 3 3 3"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            onClick={skipForward}
            disabled={isRecording}
            className="rounded-full bg-[#7C5CFC] text-white hover:bg-[#6356D7] p-1.5 transition disabled:opacity-50 shadow-sm"
            title="Forward 5 seconds"
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 20 20">
              <path
                d="M10 2v2.06A8 8 0 1 1 2 10"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M13 11l3-3-3-3"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
