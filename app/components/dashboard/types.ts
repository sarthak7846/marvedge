export interface Demo {
  id: string;
  title: string;
  description: string | null;
  videoUrl: string;
  startTime?: string | null;
  endTime?: string | null;
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
