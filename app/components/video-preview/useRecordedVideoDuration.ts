import { useEffect } from "react";
import ReactPlayer from "react-player";

type SetDuration = (duration: number) => void;

const readVideoDuration = (
  videoRef: React.RefObject<HTMLVideoElement | null>,
  setDuration: SetDuration
) => {
  if (
    videoRef.current &&
    videoRef.current.duration &&
    isFinite(videoRef.current.duration) &&
    videoRef.current.duration > 0
  ) {
    setDuration(videoRef.current.duration);
  }
};

const readDurationFromBlob = async (videoUrl: string, setDuration: SetDuration) => {
  try {
    const response = await fetch(videoUrl);
    const blob = await response.blob();
    const tempVideo = document.createElement("video");
    tempVideo.src = URL.createObjectURL(blob);
    tempVideo.preload = "metadata";

    tempVideo.onloadedmetadata = () => {
      if (tempVideo.duration && isFinite(tempVideo.duration) && tempVideo.duration > 0) {
        setDuration(tempVideo.duration);
      }
      URL.revokeObjectURL(tempVideo.src);
    };

    tempVideo.onerror = () => {
      URL.revokeObjectURL(tempVideo.src);
    };

    // Also try to load the video to trigger metadata loading
    tempVideo.load();
  } catch (error) {
    console.error("Error getting duration from blob:", error);
  }
};

const readDurationFromVideoElement = (
  videoRef: React.RefObject<HTMLVideoElement | null>,
  setDuration: SetDuration
) => {
  if (videoRef.current) {
    videoRef.current.load();
    videoRef.current.addEventListener(
      "loadedmetadata",
      () => {
        if (
          videoRef.current &&
          videoRef.current.duration &&
          isFinite(videoRef.current.duration) &&
          videoRef.current.duration > 0
        ) {
          setDuration(videoRef.current.duration);
        }
      },
      { once: true }
    );
  }
};

const forceVideoMetadataLoad = (videoRef: React.RefObject<HTMLVideoElement | null>) => {
  if (videoRef.current) {
    videoRef.current.load();
    videoRef.current.preload = "metadata";
  }
};

const forcePlayerMetadataLoad = (playerRef: React.RefObject<ReactPlayer>) => {
  if (playerRef.current) {
    const player = playerRef.current.getInternalPlayer();
    if (player) {
      player.preload = "metadata";
      player.load();
    }
  }
};

const readDurationByPlaying = (
  playerRef: React.RefObject<ReactPlayer>,
  setDuration: SetDuration
) => {
  if (playerRef.current) {
    const player = playerRef.current.getInternalPlayer();
    if (player) {
      const wasPlaying = !player.paused;
      player.currentTime = 0.1; // Seek to 0.1 seconds
      player
        .play()
        .then(() => {
          setTimeout(() => {
            if (player.duration && isFinite(player.duration) && player.duration > 0) {
              setDuration(player.duration);
            }
            if (!wasPlaying) {
              player.pause();
              player.currentTime = 0;
            }
          }, 50);
        })
        .catch(() => {
          // If play fails, just try to get duration anyway
          if (player.duration && isFinite(player.duration) && player.duration > 0) {
            setDuration(player.duration);
          }
        });
    }
  }
};

const readDurationFromHiddenVideo = (videoUrl: string, setDuration: SetDuration) => {
  const hiddenVideo = document.createElement("video");
  hiddenVideo.style.display = "none";
  hiddenVideo.preload = "metadata";
  hiddenVideo.muted = true;
  hiddenVideo.src = videoUrl;

  hiddenVideo.onloadedmetadata = () => {
    if (hiddenVideo.duration && isFinite(hiddenVideo.duration) && hiddenVideo.duration > 0) {
      setDuration(hiddenVideo.duration);
    }
    document.body.removeChild(hiddenVideo);
  };

  hiddenVideo.onerror = () => {
    document.body.removeChild(hiddenVideo);
  };

  document.body.appendChild(hiddenVideo);
  hiddenVideo.load();
};

const readDurationBySeeking = (
  playerRef: React.RefObject<ReactPlayer>,
  setDuration: SetDuration
) => {
  if (playerRef.current) {
    const player = playerRef.current.getInternalPlayer();
    if (player) {
      const wasPlaying = !player.paused;
      const wasTime = player.currentTime;

      // Try to seek to a large number to trigger duration detection
      player.currentTime = 999999;

      setTimeout(() => {
        if (player.duration && isFinite(player.duration) && player.duration > 0) {
          setDuration(player.duration);
        }
        // Restore original state
        player.currentTime = wasTime;
        if (wasPlaying) {
          player.play();
        }
      }, 100);
    }
  }
};

const readDurationWithMimeTypes = async (videoUrl: string, setDuration: SetDuration) => {
  try {
    const response = await fetch(videoUrl);
    const blob = await response.blob();

    const mimeTypes = [
      "video/webm",
      "video/mp4",
      "video/ogg",
      "video/quicktime",
      "video/x-msvideo",
    ];

    for (const mimeType of mimeTypes) {
      const tempVideo = document.createElement("video");
      tempVideo.preload = "metadata";
      tempVideo.muted = true;

      const newBlob = new Blob([blob], { type: mimeType });
      tempVideo.src = URL.createObjectURL(newBlob);

      tempVideo.onloadedmetadata = () => {
        if (tempVideo.duration && isFinite(tempVideo.duration) && tempVideo.duration > 0) {
          setDuration(tempVideo.duration);
          URL.revokeObjectURL(tempVideo.src);
          return;
        }
        URL.revokeObjectURL(tempVideo.src);
      };

      tempVideo.onerror = () => {
        URL.revokeObjectURL(tempVideo.src);
      };

      tempVideo.load();

      // Wait a bit before trying next MIME type - FASTER
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  } catch (error) {
    console.error("Error getting duration with MIME types:", error);
  }
};

interface UseRecordedVideoDurationProps {
  videoUrl: string | null;
  screenStream: MediaStream | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  playerRef: React.RefObject<ReactPlayer>;
  setDuration: SetDuration;
}

// Aggressively probes a recorded video's duration through many strategies and
// staggered timers; preserves the original timing schedule exactly.
export function useRecordedVideoDuration({
  videoUrl,
  screenStream,
  videoRef,
  playerRef,
  setDuration,
}: UseRecordedVideoDurationProps) {
  useEffect(() => {
    if (videoUrl && !screenStream) {
      const checkDuration = () => readVideoDuration(videoRef, setDuration);
      const getDurationFromBlob = () => readDurationFromBlob(videoUrl, setDuration);
      const getDurationFromVideoElement = () => readDurationFromVideoElement(videoRef, setDuration);
      const forceMetadataLoad = () => forceVideoMetadataLoad(videoRef);
      const forceReactPlayerMetadata = () => forcePlayerMetadataLoad(playerRef);
      const getDurationByPlaying = () => readDurationByPlaying(playerRef, setDuration);
      const createHiddenVideo = () => readDurationFromHiddenVideo(videoUrl, setDuration);
      const getDurationBySeeking = () => readDurationBySeeking(playerRef, setDuration);
      const getDurationWithMimeTypes = () => readDurationWithMimeTypes(videoUrl, setDuration);

      // Force metadata loading immediately (after an initial direct read)
      checkDuration();
      forceMetadataLoad();

      const timers = [
        setTimeout(checkDuration, 10),
        setTimeout(checkDuration, 50),
        setTimeout(checkDuration, 100),
        setTimeout(checkDuration, 200),
        setTimeout(checkDuration, 300),
        setTimeout(getDurationFromBlob, 20),
        setTimeout(getDurationFromBlob, 80),
        setTimeout(getDurationFromBlob, 150),
        setTimeout(getDurationFromVideoElement, 30),
        setTimeout(getDurationFromVideoElement, 90),
        setTimeout(getDurationFromVideoElement, 180),
        setTimeout(forceMetadataLoad, 15),
        setTimeout(forceMetadataLoad, 60),
        setTimeout(forceMetadataLoad, 120),
        setTimeout(forceReactPlayerMetadata, 25),
        setTimeout(forceReactPlayerMetadata, 70),
        setTimeout(forceReactPlayerMetadata, 140),
        setTimeout(getDurationByPlaying, 100),
        setTimeout(getDurationByPlaying, 200),
        setTimeout(createHiddenVideo, 5),
        setTimeout(createHiddenVideo, 40),
        setTimeout(createHiddenVideo, 100),
        setTimeout(getDurationBySeeking, 80),
        setTimeout(getDurationBySeeking, 160),
        setTimeout(getDurationWithMimeTypes, 120),
        setTimeout(getDurationWithMimeTypes, 250),
      ];

      return () => {
        timers.forEach((timer) => clearTimeout(timer));
      };
    }
  }, [videoUrl, screenStream, videoRef, playerRef, setDuration]);
}
