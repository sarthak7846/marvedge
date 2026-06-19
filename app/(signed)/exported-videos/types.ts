export interface ExportedVideo {
  id: string;
  title: string;
  description: string | null;
  exportedUrl: string;
  shareableUrl: string;
  createdAt: string;
  updatedAt: string;
}

export type VideoSortOption = "title" | "updatedAt" | "createdAt" | "views";
