"use client";

import { SessionProvider } from "next-auth/react";
import TopLoader from "./components/TopLoader";
import { ThemeProvider } from "next-themes";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchInterval={5 * 60} refetchOnWindowFocus={true}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        {children}
        <TopLoader />
      </ThemeProvider>
    </SessionProvider>
  );
}
