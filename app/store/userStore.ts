import { create } from "zustand";

export const useUserStore = create<{
  profileImage: string | null | undefined;
  fetchProfileImage: () => Promise<void>;
  refreshProfileImage: () => Promise<void>;
}>((set, get) => ({
  profileImage: null,
  fetchProfileImage: async () => {
    try {
      const res = await fetch("/api/user/get", { credentials: "include" });
      if (!res.ok) {
        set({ profileImage: null });
        return;
      }
      const data = await res.json();
      if (data.user?.image && data.user.image.trim()) {
        set({ profileImage: data.user.image + `?t=${Date.now()}` });
      } else {
        set({ profileImage: null });
      }
    } catch (error) {
      console.error("Error fetching user image:", error);
      set({ profileImage: null });
    }
  },
  refreshProfileImage: () => get().fetchProfileImage(),
}));
