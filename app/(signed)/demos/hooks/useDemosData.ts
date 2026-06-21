import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { formatTime } from "@/app/lib/dateTimeUtils";
import { probeVideoDuration } from "../utils/demoHelpers";
import type { Demo } from "../types";

export function useDemosData(initialDemos: Demo[]) {
  const [demos, setDemos] = useState<Demo[]>(initialDemos);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [durationMap, setDurationMap] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const demo of initialDemos) {
      if (demo.duration && demo.duration > 0) {
        map[demo.id] = formatTime(demo.duration);
      }
    }
    return map;
  });

  const fetchDurations = useCallback(async (demoList: Demo[]) => {
    const uncached = demoList.filter((d) => !d.duration && d.videoUrl);
    for (const demo of uncached) {
      try {
        let playableUrl = demo.videoUrl;
        if (demo.videoUrl.startsWith("gs://")) {
          const res = await fetch(`/api/gcs/resolve?url=${encodeURIComponent(demo.videoUrl)}`);
          const data = await res.json();
          if (data.ok && data.playableUrl) {
            playableUrl = data.playableUrl;
          } else {
            continue;
          }
        }
        const dur = await probeVideoDuration(playableUrl);
        if (dur > 0) {
          setDurationMap((prev) => ({ ...prev, [demo.id]: formatTime(dur) }));

          fetch("/api/demo/duration", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: demo.id, duration: dur }),
          }).catch(() => {});
        }
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (demos.length > 0) {
      fetchDurations(demos);
    }
  }, [demos, fetchDurations]);

  const fetchDemos = async () => {
    setLoading(true);
    try {
      const response = await axios.get("/api/demo");
      setDemos(response.data.demos || []);
    } catch (err: unknown) {
      console.error("Error fetching demos:", err);
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message || "Failed to fetch demos");
      } else {
        setError("Failed to fetch demos");
      }
    } finally {
      setLoading(false);
    }
  };

  const deleteDemo = async (id: string) => {
    try {
      await axios.delete("/api/demo/", {
        params: {
          id,
        },
      });
      await fetchDemos();
    } catch (error) {
      console.error("Error deleting demo:", error);
      setError("Failed to delete demo");
    }
  };

  return { demos, loading, error, durationMap, deleteDemo };
}
