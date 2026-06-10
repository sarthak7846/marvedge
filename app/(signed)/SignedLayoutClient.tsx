"use client";
import React, { ReactNode, useEffect, useState } from "react";
import SidemenuDashboard from "../components/SidemenuDashboard";
import SignedHeader from "../components/SignedHeader";
import { usePathname } from "next/navigation";
import { getNavbarConfig } from "@/app/lib/metadata";
import { useTheme } from "next-themes";

const SignedLayoutClient = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname();
  const isRecorderOrEditor = pathname.startsWith("/recorder") || pathname.startsWith("/editor");
  const navbarConfig = getNavbarConfig(pathname);
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const effectiveTheme = theme === "system" ? resolvedTheme : theme;
  const isDark = mounted && effectiveTheme === "dark";

  console.log("Current pathname:", pathname);
  console.log("Navbar config:", navbarConfig);

  return (
    <div
      className={`flex h-screen flex-col overflow-hidden ${
        isDark ? "bg-[#05050d] text-white" : ""
      }`}
    >
      {navbarConfig && (
        <SignedHeader
          titleText={navbarConfig.titleText}
          iconSRC={navbarConfig.iconSRC}
          iconALT={navbarConfig.iconALT}
          className={!isRecorderOrEditor ? "md:pl-72" : ""}
        />
      )}
      <div className="flex flex-1 overflow-hidden">
        {!isRecorderOrEditor && <SidemenuDashboard />}
        <main
          className={`main flex-1 overflow-y-auto ${
            isDark ? "bg-[#05050d] dark-glow-main" : "bg-[#F1ECFF]"
          } ${!isRecorderOrEditor ? "md:ml-72" : ""}`}
          style={{ height: "100%" }}
        >
          {children}
        </main>
      </div>
    </div>
  );
};

export default SignedLayoutClient;
