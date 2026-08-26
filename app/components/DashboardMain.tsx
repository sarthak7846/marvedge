import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { dashboardAnimationStyles } from "./dashboard/dashboardStyles";
import { Demo } from "./dashboard/types";
import DashboardStatCards from "./dashboard/DashboardStatCards";
import RecentDemos from "./dashboard/RecentDemos";

interface DashboardMainProps {
  initialDemos: Demo[];
  totalCount: number;
  totalViews: number;
  activeShares: number;
}

// Builds the editor query string for a demo, preserving any saved editing state.
const buildDemoEditorParams = (demo: Demo): string => {
  const params = new URLSearchParams({
    video: demo.videoUrl,
    ...(demo.startTime && { startTime: demo.startTime }),
    ...(demo.endTime && { endTime: demo.endTime }),
    title: demo.title || "",
    description: demo.description || "",
    demoId: demo.id,
  });

  if (demo.editing) {
    if (demo.editing.segments) {
      params.append("segments", JSON.stringify(demo.editing.segments));
    }
    if (demo.editing.zoom) {
      params.append("zoom", JSON.stringify(demo.editing.zoom));
    }
    if (demo.editing.subtitles) {
      params.append("subtitles", JSON.stringify(demo.editing.subtitles));
    }
    if (demo.editing.textOverlays) {
      params.append("textOverlays", JSON.stringify(demo.editing.textOverlays));
    }
    if (typeof demo.editing.background !== "undefined" && demo.editing.background !== null) {
      params.append("background", String(demo.editing.background));
    }
    if (demo.editing.backgroundType) {
      params.append("backgroundType", demo.editing.backgroundType);
    }
    if (demo.editing.aspectRatio) {
      params.append("aspectRatio", demo.editing.aspectRatio);
    }
    if (demo.editing.browserFrame) {
      params.append("browserFrame", JSON.stringify(demo.editing.browserFrame));
    }
  } else if (demo.segments) {
    params.append("segments", JSON.stringify(demo.segments));
  }

  return params.toString();
};

const DashboardMain = ({
  initialDemos,
  totalCount,
  totalViews,
  activeShares,
}: DashboardMainProps) => {
  const router = useRouter();
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const effectiveTheme = theme === "system" ? resolvedTheme : theme;
  const isDark = mounted && effectiveTheme === "dark";

  const handleEditDemo = (demo: Demo) => {
    router.push(`/editor?${buildDemoEditorParams(demo)}`);
  };
  const isLoading = false;

  const demos = initialDemos;

  return (
    <div
      className="p-2 sm:p-4 md:p-8 bg-[#F1ECFF] dark:bg-[#05050d] min-h-full pt-2 sm:pt-0 transition-colors duration-300"
      style={{ fontFamily: "var(--font-raleway)" }}
    >
      <style jsx>{dashboardAnimationStyles}</style>
      <div className="mb-4 sm:mb-6 md:mb-8">
        <h2 className="sub-heading text-xs sm:text-sm md:text-base lg:text-lg font-light text-gray-400 mb-3 sm:mb-4">
          Here&apos;s what happening with your demos today
        </h2>
        <DashboardStatCards
          isDark={isDark}
          totalCount={totalCount}
          totalViews={totalViews}
          activeShares={activeShares}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:gap-4 md:gap-8">
        <RecentDemos
          demos={demos}
          isLoading={isLoading}
          isDark={isDark}
          onViewAll={() => router.push("/demos")}
          onEditDemo={handleEditDemo}
        />
      </div>
    </div>
  );
};

export default DashboardMain;
