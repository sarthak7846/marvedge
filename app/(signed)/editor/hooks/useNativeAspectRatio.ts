import { useEffect, useState } from "react";

export function useNativeAspectRatio(videoUrl: string | null) {
  const [nativeAspectRatio, setNativeAspectRatio] = useState("16/9");

  useEffect(() => {
    if (!videoUrl) {
      setNativeAspectRatio("16/9");
      return;
    }

    const probeVideo = document.createElement("video");
    probeVideo.preload = "metadata";
    probeVideo.src = videoUrl;

    const handleLoaded = () => {
      if (probeVideo.videoWidth > 0 && probeVideo.videoHeight > 0) {
        setNativeAspectRatio(`${probeVideo.videoWidth}/${probeVideo.videoHeight}`);
      }
    };

    probeVideo.addEventListener("loadedmetadata", handleLoaded);
    return () => {
      probeVideo.removeEventListener("loadedmetadata", handleLoaded);
      probeVideo.src = "";
    };
  }, [videoUrl]);

  return nativeAspectRatio;
}
