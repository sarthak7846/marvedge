export interface Demo {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  exportedUrl?: string;
  startTime?: string;
  endTime?: string;
  duration?: number | null;
  segments?: unknown;
  createdAt: string;
  updatedAt: string;
  editing?: {
    segments?: unknown;
    zoom?: unknown;
    subtitles?: unknown;
    textOverlays?: unknown;
    background?: string | null;
    backgroundType?: string;
    aspectRatio?: string;
    browserFrame?: unknown;
  };
}

export type DemoSortOption = "title" | "updatedAt" | "createdAt" | "views";
