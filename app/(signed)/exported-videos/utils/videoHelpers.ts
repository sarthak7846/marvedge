import type { ExportedVideo, VideoSortOption } from "../types";

export function filterAndSortVideos(
  videos: ExportedVideo[],
  search: string,
  sortOption: VideoSortOption
): ExportedVideo[] {
  return videos
    .filter(
      (video) =>
        video.title.toLowerCase().includes(search.toLowerCase()) ||
        (video.description || "").toLowerCase().includes(search.toLowerCase())
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
