import type { Demo, DemoSortOption } from "../types";

export function probeVideoDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    const cleanup = () => {
      video.removeAttribute("src");
      video.load();
    };
    video.addEventListener("loadedmetadata", () => {
      const dur = video.duration;
      cleanup();
      resolve(Number.isFinite(dur) ? dur : 0);
    });
    video.addEventListener("error", () => {
      cleanup();
      resolve(0);
    });
    video.src = url;
  });
}

export function buildDemoEditorParams(demo: Demo): string {
  const params = new URLSearchParams({
    video: demo.videoUrl,
    startTime: demo.startTime || "",
    endTime: demo.endTime || "",
    title: demo.title || "",
    description: demo.description || "",
    demoId: demo.id,
  });

  if (demo.editing) {
    if (demo.editing.segments) {
      params.append("segments", JSON.stringify(demo.editing.segments));
    }
    if (demo.editing.zoom) {
      params.append("zoom", JSON.stringify(demo.editing.zoom));
    }
    if (demo.editing.subtitles) {
      params.append("subtitles", JSON.stringify(demo.editing.subtitles));
    }
    if (demo.editing.textOverlays) {
      params.append("textOverlays", JSON.stringify(demo.editing.textOverlays));
    }
    if (typeof demo.editing.background !== "undefined" && demo.editing.background !== null) {
      params.append("background", String(demo.editing.background));
    }
    if (demo.editing.backgroundType) {
      params.append("backgroundType", demo.editing.backgroundType);
    }
    if (demo.editing.aspectRatio) {
      params.append("aspectRatio", demo.editing.aspectRatio);
    }
    if (demo.editing.browserFrame) {
      params.append("browserFrame", JSON.stringify(demo.editing.browserFrame));
    }
  } else if (demo.segments) {
    params.append("segments", JSON.stringify(demo.segments));
  }

  return params.toString();
}

export function filterAndSortDemos(
  demos: Demo[],
  search: string,
  sortOption: DemoSortOption
): Demo[] {
  return demos
    .filter(
      (demo) =>
        demo.title.toLowerCase().includes(search.toLowerCase()) ||
        demo.description.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sortOption === "title") {
        return a.title.localeCompare(b.title);
      } else if (sortOption === "updatedAt") {
        return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
      } else if (sortOption === "createdAt") {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      } else if (sortOption === "views") {
        return 0;
      }
      return 0;
    });
}
