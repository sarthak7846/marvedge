import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export type SessionData = ReturnType<typeof useSession>["data"];

async function fetchUserImage(
  setProfileImage: (image: string | null | undefined) => void
): Promise<void> {
  try {
    const res = await fetch("/api/user/get", {
      credentials: "include",
    });
    if (!res.ok) {
      setProfileImage(null);
      return;
    }
    const data = await res.json();
    if (data.user?.image && data.user.image.trim()) {
      setProfileImage(data.user.image + `?t=${Date.now()}`);
    } else {
      setProfileImage(null);
    }
  } catch {
    setProfileImage(null);
  }
}

// Loads the current user's profile image and keeps it in sync with the
// "photoUpdated" window event fired after a photo change.
export function useProfileImage(session: SessionData) {
  const [profileImage, setProfileImage] = useState<string | null | undefined>(null);

  useEffect(() => {
    if (session?.user) {
      fetchUserImage(setProfileImage);
    }
  }, [session]);

  useEffect(() => {
    const handlePhotoUpdate = () => {
      fetchUserImage(setProfileImage);
    };

    window.addEventListener("photoUpdated", handlePhotoUpdate);
    return () => window.removeEventListener("photoUpdated", handlePhotoUpdate);
  }, []);

  return profileImage;
}
