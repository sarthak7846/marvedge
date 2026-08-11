"use client";

import { useEffect, useRef } from "react";
import { useUserStore } from "@/app/store/userStore";
import { useSession } from "next-auth/react";

export function ProfileImageInitializer() {
  const { data: session, status } = useSession();
  const fetchProfileImage = useUserStore((state) => state.fetchProfileImage);
  const isFetched = useUserStore((state) => state.isFetched);
  const hasInitialized = useRef(false);

  useEffect(() => {
    // Only initialize once when:
    // 1. Session is authenticated
    // 2. Not already fetched
    // 3. Not already initialized
    if (status === "authenticated" && session?.user && !isFetched && !hasInitialized.current) {
      hasInitialized.current = true;
      fetchProfileImage();
    }

    // Reset when user logs out
    if (status === "unauthenticated") {
      hasInitialized.current = false;
    }
  }, [session, status, fetchProfileImage, isFetched]);

  // This component doesn't render anything
  return null;
}
