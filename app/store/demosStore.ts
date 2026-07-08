import { create } from "zustand";
import axios from "axios";
import { formatTime } from "@/app/lib/dateTimeUtils";
import { probeVideoDuration } from "@/app/(signed)/demos/utils/demoHelpers";
import type { Demo, DemoSortOption } from "@/app/(signed)/demos/types";

// Page-level state for the Demos route: the list data fetched from the server
// plus the toolbar filters (search / view / sort). Extracted from useDemosData
// and DemosClient so the client and its children can read via selectors instead
// of prop-drilling. Refs (dropdown nodes, etc.) stay in the components.
interface DemosStore {
  // Data
  demos: Demo[];
  loading: boolean;
  error: string | null;
  durationMap: Record<string, string>;

  // Filters
  search: string;
  view: string;
  sortOption: DemoSortOption;

  // Filter setters
  setSearch: (search: string) => void;
  setView: (view: string) => void;
  setSortOption: (sortOption: DemoSortOption) => void;

  // Data actions
  initialize: (initialDemos: Demo[]) => void;
  fetchDemos: () => Promise<void>;
  deleteDemo: (id: string) => Promise<void>;
  fetchDurations: (demoList: Demo[]) => Promise<void>;

  reset: () => void;
}

const initialState = {
  demos: [] as Demo[],
  loading: false,
  error: null as string | null,
  durationMap: {} as Record<string, string>,
  search: "",
  view: "list",
  sortOption: "updatedAt" as DemoSortOption,
};

function buildDurationMap(demos: Demo[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const demo of demos) {
    if (demo.duration && demo.duration > 0) {
      map[demo.id] = formatTime(demo.duration);
    }
  }
  return map;
}

export const useDemosStore = create<DemosStore>((set, get) => ({
  ...initialState,

  setSearch: (search) => set({ search }),
  setView: (view) => set({ view }),
  setSortOption: (sortOption) => set({ sortOption }),

  initialize: (initialDemos) =>
    set({
      demos: initialDemos,
      durationMap: buildDurationMap(initialDemos),
      loading: false,
      error: null,
    }),

  fetchDemos: async () => {
    set({ loading: true });
    try {
      const response = await axios.get("/api/demo");
      set({ demos: response.data.demos || [] });
    } catch (err: unknown) {
      console.error("Error fetching demos:", err);
      if (axios.isAxiosError(err)) {
        set({ error: err.response?.data?.message || "Failed to fetch demos" });
      } else {
        set({ error: "Failed to fetch demos" });
      }
    } finally {
      set({ loading: false });
    }
  },

  deleteDemo: async (id) => {
    try {
      await axios.delete("/api/demo/", { params: { id } });
      await get().fetchDemos();
    } catch (error) {
      console.error("Error deleting demo:", error);
      set({ error: "Failed to delete demo" });
    }
  },

  fetchDurations: async (demoList) => {
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
          set((state) => ({
            durationMap: { ...state.durationMap, [demo.id]: formatTime(dur) },
          }));

          fetch("/api/demo/duration", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: demo.id, duration: dur }),
          }).catch(() => {});
        }
      } catch {}
    }
  },

  reset: () => set({ ...initialState }),
}));
