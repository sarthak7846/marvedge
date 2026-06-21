import { useState } from "react";
import ReactPlayer from "react-player";
import Image from "next/image";
import { formatTime } from "@/app/lib/dateTimeUtils";
import VideoUtilityControls from "./VideoUtilityControls";

interface CustomVideoControlsProps {
  playerRef: React.RefObject<ReactPlayer>;
  duration: number;
  currentTime: number;
  setCurrentTime: (t: number) => void;
  setPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  playing: boolean;
  volume: number;
  setVolume: (t: number) => void;
  playbackSpeed: number;
  handleFullscreen: () => void;
}

export default function CustomVideoControls({
  playerRef,
  duration,
  currentTime,
  setCurrentTime,
  setPlaying,
  playing,
  volume,
  setVolume,
  playbackSpeed,
  handleFullscreen,
}: CustomVideoControlsProps) {
  const [dragging, setDragging] = useState(false);
  const [dragValue, setDragValue] = useState(0);

  const handlePlayPause = () => {
    setPlaying((prev) => {
      if (prev) {
        playerRef.current?.getInternalPlayer()?.pause?.();
      } else {
        playerRef.current?.getInternalPlayer()?.play?.();
      }
      return !prev;
    });
  };

  const handleSeekStart = () => {
    setDragging(true);
    setDragValue(currentTime / Math.max(0.0001, playbackSpeed));
    setPlaying(false);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const effectiveValue = Number(e.target.value);
    const speed = Math.max(0.0001, playbackSpeed);
    const sourceValue = effectiveValue * speed;
    setDragValue(effectiveValue);
    setPlaying(false);
    if (playerRef.current) {
      const player = playerRef.current.getInternalPlayer();
      if (player) {
        player.currentTime = sourceValue;
        player.dispatchEvent(new Event("seeking"));
      }
    }
  };

  const handleSeekEnd = (e: React.PointerEvent<HTMLInputElement>) => {
    const effectiveValue = Number((e.target as HTMLInputElement).value);
    const speed = Math.max(0.0001, playbackSpeed);
    const sourceValue = effectiveValue * speed;
    setCurrentTime(sourceValue);

    if (playerRef.current) {
      const player = playerRef.current.getInternalPlayer();
      if (player) {
        player.currentTime = sourceValue;
        player.dispatchEvent(new Event("seeking"));
        playerRef.current.seekTo(sourceValue, "seconds");
      }
    }

    setDragging(false);
  };

  const displayDuration = duration;
  const speed = Math.max(0.0001, playbackSpeed);
  const effectiveDuration = displayDuration / speed;
  const effectiveCurrentTime = currentTime / speed;

  return (
    <div className="w-full px-6 pb-2 pt-0 flex flex-col gap-2">
      <div className="flex items-center gap-4 w-full">
        <button
          onClick={handlePlayPause}
          className="rounded-full cursor-pointer bg-[#E6E1FA] text-[#7C5CFC] hover:bg-[#7C5CFC] hover:text-white p-2 transition playback-utility-icon"
        >
          {playing ? (
            <Image src="/icons/pause.png" alt="Pause" width={24} height={24} />
          ) : (
            <Image src="/icons/play.png" alt="Play" width={24} height={24} />
          )}
        </button>

        <div className="flex items-center gap-3 flex-1">
          <input
            type="range"
            min={0}
            max={effectiveDuration}
            step={0.01}
            value={dragging ? dragValue : effectiveCurrentTime}
            onPointerDown={handleSeekStart}
            onChange={handleSeek}
            onPointerUp={handleSeekEnd}
            className="flex-1 h-2 rounded-lg appearance-none cursor-pointer flex-1 accent-[#A594F9] playback-progress-bar-rail"
            style={{
              background: `linear-gradient(90deg, #7C5CFC ${(effectiveCurrentTime / Math.max(0.0001, effectiveDuration)) * 100}%, var(--playback-rail-bg) ${(effectiveCurrentTime / Math.max(0.0001, effectiveDuration)) * 100}%)`,
            }}
          />
          <span className="text-xs text-[#7C5CFC] font-mono min-w-[60px] text-right">
            {formatTime(effectiveCurrentTime)} / {formatTime(effectiveDuration || 0)}
          </span>
        </div>

        <VideoUtilityControls
          playerRef={playerRef}
          effectiveCurrentTime={effectiveCurrentTime}
          effectiveDuration={effectiveDuration}
          speed={speed}
          setCurrentTime={setCurrentTime}
          volume={volume}
          setVolume={setVolume}
          handleFullscreen={handleFullscreen}
        />
      </div>
    </div>
  );
}
