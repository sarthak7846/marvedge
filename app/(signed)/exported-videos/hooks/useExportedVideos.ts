import { useState, useEffect } from "react";
import axios from "axios";
import type { ExportedVideo } from "../types";

export function useExportedVideos() {
  const [videos, setVideos] = useState<ExportedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExportedVideos = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get("/api/exported-videos");
      setVideos(response.data.exportedVideos || []);
    } catch (err: unknown) {
      console.error("Error fetching exported videos:", err);
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message || "Failed to fetch exported videos");
      } else {
        setError("Failed to fetch exported videos");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExportedVideos();
  }, []);

  const deleteVideo = async (id: string) => {
    try {
      await axios.delete("/api/exported-videos", {
        params: { id },
      });
      await fetchExportedVideos();
    } catch (deleteError) {
      console.error("Error deleting exported video:", deleteError);
      setError("Failed to delete exported video");
    }
  };

  return { videos, loading, error, deleteVideo };
}
