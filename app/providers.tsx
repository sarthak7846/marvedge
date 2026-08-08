"use client";

import { SessionProvider } from "next-auth/react";
import TopLoader from "./components/TopLoader";
import { ThemeProvider } from "next-themes";
import { ProfileImageInitializer } from "./components/ProfileImageInitializer";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchInterval={5 * 60} refetchOnWindowFocus={true}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <ProfileImageInitializer />
        {children}
        <TopLoader />
      </ThemeProvider>
    </SessionProvider>
  );
}
