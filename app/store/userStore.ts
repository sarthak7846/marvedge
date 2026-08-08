// app/store/userStore.ts
import { create } from "zustand";

const PROFILE_IMAGE_CACHE_KEY = "marvedge_profile_image";
const PROFILE_IMAGE_TIMESTAMP_KEY = "marvedge_profile_image_ts";
const PROFILE_IMAGE_FETCHED_KEY = "marvedge_profile_image_fetched";

const optimizeCloudinaryUrl = (url: string, width: number = 100, height: number = 100): string => {
  if (!url || !url.includes("cloudinary.com")) {
    return url;
  }
  const baseUrl = url.split("/upload/")[0] + "/upload/";
  const imagePath = url.split("/upload/")[1]?.split("?")[0];

  if (!imagePath) {
    return url;
  }

  return `${baseUrl}w_${width},h_${height},c_fill,g_face,q_auto,f_auto/${imagePath}`;
};

// Global promise to prevent multiple simultaneous fetches
let fetchPromise: Promise<void> | null = null;

export const useUserStore = create<{
  profileImage: string | null | undefined;
  isLoading: boolean;
  isFetched: boolean;
  fetchProfileImage: () => Promise<void>;
  refreshProfileImage: () => Promise<void>;
  clearCache: () => void;
  resetStore: () => void;
}>((set, get) => ({
  profileImage: null,
  isLoading: false,
  isFetched: false,

  fetchProfileImage: async () => {
    // Check if already fetched in this session
    try {
      const alreadyFetched = sessionStorage.getItem(PROFILE_IMAGE_FETCHED_KEY);
      if (alreadyFetched === "true") {
        // Check if image is in cache
        const cachedImage = sessionStorage.getItem(PROFILE_IMAGE_CACHE_KEY);
        if (cachedImage) {
          set({ profileImage: cachedImage, isLoading: false, isFetched: true });
          return;
        }
      }
    } catch {
      // Ignore storage errors
    }

    // If there's already a fetch in progress, return that promise
    if (fetchPromise) {
      await fetchPromise;
      return;
    }

    // If already loading, return
    if (get().isLoading) {
      return;
    }

    // Check cache first
    try {
      const cachedImage = sessionStorage.getItem(PROFILE_IMAGE_CACHE_KEY);
      const cachedTimestamp = sessionStorage.getItem(PROFILE_IMAGE_TIMESTAMP_KEY);
      if (cachedImage && cachedTimestamp) {
        const age = Date.now() - parseInt(cachedTimestamp);
        if (age < 5 * 60 * 1000) {
          // 5 minutes cache
          set({ profileImage: cachedImage, isLoading: false, isFetched: true });
          try {
            sessionStorage.setItem(PROFILE_IMAGE_FETCHED_KEY, "true");
          } catch {
            // Ignore storage errors
          }
          return;
        }
      }
    } catch {
      // Intentionally empty - we just continue without cache
    }

    // Create the fetch promise
    fetchPromise = (async () => {
      set({ isLoading: true });

      try {
        const res = await fetch("/api/user/get", {
          credentials: "include",
          cache: "no-store",
        });

        if (!res.ok) {
          set({ profileImage: null, isLoading: false, isFetched: false });
          return;
        }

        const data = await res.json();

        if (data.user?.image && data.user.image.trim()) {
          const optimizedUrl = optimizeCloudinaryUrl(data.user.image, 100, 100);

          try {
            sessionStorage.setItem(PROFILE_IMAGE_CACHE_KEY, optimizedUrl);
            sessionStorage.setItem(PROFILE_IMAGE_TIMESTAMP_KEY, String(Date.now()));
            sessionStorage.setItem(PROFILE_IMAGE_FETCHED_KEY, "true");
          } catch {
            // Intentionally empty
          }

          set({ profileImage: optimizedUrl, isLoading: false, isFetched: true });
        } else {
          set({ profileImage: null, isLoading: false, isFetched: true });
        }
      } catch (error) {
        console.error("Error fetching user image:", error);
        set({ profileImage: null, isLoading: false, isFetched: false });
      } finally {
        fetchPromise = null;
      }
    })();

    await fetchPromise;
  },

  refreshProfileImage: async () => {
    try {
      sessionStorage.removeItem(PROFILE_IMAGE_CACHE_KEY);
      sessionStorage.removeItem(PROFILE_IMAGE_TIMESTAMP_KEY);
      sessionStorage.removeItem(PROFILE_IMAGE_FETCHED_KEY);
    } catch {
      // Ignore storage errors
    }
    fetchPromise = null;
    set({ isFetched: false });
    await get().fetchProfileImage();
  },

  clearCache: () => {
    try {
      sessionStorage.removeItem(PROFILE_IMAGE_CACHE_KEY);
      sessionStorage.removeItem(PROFILE_IMAGE_TIMESTAMP_KEY);
      sessionStorage.removeItem(PROFILE_IMAGE_FETCHED_KEY);
    } catch {
      // Ignore storage errors
    }
    fetchPromise = null;
    set({ profileImage: null, isLoading: false, isFetched: false });
  },

  resetStore: () => {
    fetchPromise = null;
    set({ profileImage: null, isLoading: false, isFetched: false });
  },
}));
