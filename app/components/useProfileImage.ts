import { useEffect, useState } from "react";
import type { Session } from "next-auth";

export function useProfileImage(session: Session | null) {
  const [profileImage, setProfileImage] = useState<string | null | undefined>(null);

  useEffect(() => {
    const fetchUserImage = async () => {
      try {
        const res = await fetch("/api/user/get");
        const data = await res.json();
        if (data.user?.image && data.user.image.trim()) {
          setProfileImage(data.user.image + `?t=${Date.now()}`);
        } else {
          setProfileImage(null);
        }
      } catch (error) {
        console.error("Error fetching user image:", error);
        setProfileImage(null);
      }
    };

    if (session?.user) {
      fetchUserImage();
    }
  }, [session]);

  useEffect(() => {
    const handlePhotoUpdate = () => {
      const fetchUserImage = async () => {
        try {
          const res = await fetch("/api/user/get");
          const data = await res.json();
          if (data.user?.image && data.user.image.trim()) {
            setProfileImage(data.user.image + `?t=${Date.now()}`);
          } else {
            setProfileImage(null);
          }
        } catch (error) {
          console.error("Error fetching user image:", error);
          setProfileImage(null);
        }
      };
      fetchUserImage();
    };

    window.addEventListener("photoUpdated", handlePhotoUpdate);
    return () => window.removeEventListener("photoUpdated", handlePhotoUpdate);
  }, []);

  return profileImage;
}
