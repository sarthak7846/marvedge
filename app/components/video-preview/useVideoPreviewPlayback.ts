import { useEffect, useState } from "react";
import ReactPlayer from "react-player";

interface UseVideoPreviewPlaybackProps {
  isRecording: boolean;
  screenStream: MediaStream | null;
  onTimeChange?: (time: number) => void;
  playerRef: React.RefObject<ReactPlayer>;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function useVideoPreviewPlayback({
  isRecording,
  screenStream,
  onTimeChange,
  playerRef,
  videoRef,
  containerRef,
}: UseVideoPreviewPlaybackProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(!isRecording);
  const [dragging, setDragging] = useState(false);
  const [dragValue, setDragValue] = useState(0);
  const [volume, setVolume] = useState(1);

  const handlePlayPause = () => {
    if (isRecording) {
      return;
    }
    setPlaying((prev) => {
      if (screenStream && videoRef.current) {
        if (prev) {
          videoRef.current.pause();
        } else {
          videoRef.current.play();
        }
      } else {
        if (prev) {
          playerRef.current?.getInternalPlayer()?.pause?.();
        } else {
          playerRef.current?.getInternalPlayer()?.play?.();
        }
      }
      return !prev;
    });
  };

  const handleSeekStart = () => {
    if (isRecording) {
      return;
    }
    setDragging(true);
    setDragValue(currentTime);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isRecording) {
      return;
    }
    setDragValue(Number(e.target.value));
  };

  const handleSeekEnd = (e: React.PointerEvent<HTMLInputElement>) => {
    if (isRecording) {
      return;
    }
    const value = Number((e.target as HTMLInputElement).value);
    setCurrentTime(value);
    if (screenStream && videoRef.current) {
      videoRef.current.currentTime = value;
    } else {
      playerRef.current?.seekTo(value, "seconds");
    }
    onTimeChange?.(value);
    setDragging(false);
  };

  const handleFullscreen = () => {
    if (containerRef.current) {
      if (!document.fullscreenElement) {
        containerRef.current.requestFullscreen().catch(() => {
          console.log("Fullscreen request failed");
        });
      } else {
        document.exitFullscreen();
      }
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = Number(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
    if (playerRef.current) {
      const player = playerRef.current.getInternalPlayer();
      if (player && player.volume !== undefined) {
        player.volume = newVolume;
      }
    }
  };

  // Set srcObject when screenStream changes
  useEffect(() => {
    if (videoRef.current && screenStream) {
      videoRef.current.srcObject = screenStream;
    }
  }, [screenStream, videoRef]);

  return {
    currentTime,
    setCurrentTime,
    duration,
    setDuration,
    playing,
    dragging,
    dragValue,
    volume,
    handlePlayPause,
    handleSeekStart,
    handleSeek,
    handleSeekEnd,
    handleFullscreen,
    handleVolumeChange,
  };
}
