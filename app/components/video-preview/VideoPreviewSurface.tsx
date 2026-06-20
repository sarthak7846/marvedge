import ReactPlayer from "react-player";

interface ScreenStreamVideoProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isRecording: boolean;
  setDuration: (duration: number) => void;
  setCurrentTime: (time: number) => void;
  onTimeChange?: (time: number) => void;
}

export function ScreenStreamVideo({
  videoRef,
  isRecording,
  setDuration,
  setCurrentTime,
  onTimeChange,
}: ScreenStreamVideoProps) {
  return (
    <video
      ref={videoRef}
      autoPlay
      muted={isRecording}
      playsInline
      style={{
        width: "100%",
        height: "100%",
        objectFit: "contain",
        borderRadius: "1.25rem",
        background: "#F6F3FF",
      }}
      onLoadedMetadata={() => {
        if (
          videoRef.current &&
          videoRef.current.duration &&
          isFinite(videoRef.current.duration) &&
          videoRef.current.duration > 0
        ) {
          setDuration(videoRef.current.duration);
        }
      }}
      onCanPlay={() => {
        if (
          videoRef.current &&
          videoRef.current.duration &&
          isFinite(videoRef.current.duration) &&
          videoRef.current.duration > 0
        ) {
          setDuration(videoRef.current.duration);
        }
      }}
      onTimeUpdate={() => {
        if (videoRef.current) {
          setCurrentTime(videoRef.current.currentTime);
          onTimeChange?.(videoRef.current.currentTime);
        }
      }}
    />
  );
}

interface PreviewReactPlayerProps {
  playerRef: React.RefObject<ReactPlayer>;
  videoUrl: string | null;
  playing: boolean;
  isRecording: boolean;
  volume: number;
  duration: number;
  setDuration: (duration: number) => void;
  setCurrentTime: (time: number) => void;
  onTimeChange?: (time: number) => void;
}

export function PreviewReactPlayer({
  playerRef,
  videoUrl,
  playing,
  isRecording,
  volume,
  duration,
  setDuration,
  setCurrentTime,
  onTimeChange,
}: PreviewReactPlayerProps) {
  return (
    <ReactPlayer
      ref={playerRef}
      url={videoUrl || undefined}
      playing={playing}
      controls={false}
      muted={isRecording}
      volume={volume}
      width="100%"
      height="100%"
      style={{
        objectFit: "contain",
        borderRadius: "1.25rem",
        background: "#F6F3FF",
      }}
      onError={(e) => console.error("Video failed to load", e)}
      onStart={() => {
        // Ensure currentTime starts from 0 when video starts
        setCurrentTime(0);
        onTimeChange?.(0);
      }}
      onPlay={() => {
        // Ensure currentTime is 0 when video starts playing
        setCurrentTime(0);
        onTimeChange?.(0);
      }}
      onDuration={(dur) => {
        if (isFinite(dur) && !isNaN(dur) && dur > 0) {
          setDuration(dur);
        }
      }}
      onReady={() => {
        console.log("Video loaded");
        // Try to get duration again when video is ready - FASTER
        setTimeout(() => {
          if (playerRef.current) {
            const player = playerRef.current.getInternalPlayer();
            if (player && player.duration && isFinite(player.duration) && player.duration > 0) {
              setDuration(player.duration);
            }
          }
        }, 10);

        // Additional attempt after a longer delay - FASTER
        setTimeout(() => {
          if (playerRef.current) {
            const player = playerRef.current.getInternalPlayer();
            if (player && player.duration && isFinite(player.duration) && player.duration > 0) {
              setDuration(player.duration);
            }
          }
        }, 100);
      }}
      progressInterval={50}
      onProgress={({ playedSeconds }) => {
        // Ensure currentTime starts from 0 immediately
        if (playedSeconds === 0) {
          setCurrentTime(0);
          onTimeChange?.(0);
        } else {
          setCurrentTime(playedSeconds);
          onTimeChange?.(playedSeconds);
        }

        // Try to get duration when video starts playing - FASTER
        if (playedSeconds > 0 && duration === 0) {
          setTimeout(() => {
            if (playerRef.current) {
              const player = playerRef.current.getInternalPlayer();
              if (player && player.duration && isFinite(player.duration) && player.duration > 0) {
                setDuration(player.duration);
              }
            }
          }, 10);
        }
      }}
      config={{
        file: {
          attributes: {
            preload: "metadata",
          },
        },
      }}
    />
  );
}
