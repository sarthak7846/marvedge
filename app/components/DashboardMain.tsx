import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatDate } from "@/app/lib/dateTimeUtils";
import { Play, Eye, CheckCircle, Share2, TrendingUp } from "lucide-react";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";

interface Demo {
  id: string;
  title: string;
  description: string | null;
  videoUrl: string;
  startTime?: string | null;
  endTime?: string | null;
  segments?: unknown;
  createdAt: string;
  updatedAt: string;
  editing?: {
    segments?: unknown;
    zoom?: unknown;
    aspectRatio?: string;
    browserFrame?: unknown;
  };
}

interface DashboardMainProps {
  initialDemos: Demo[];
  totalCount: number;
  totalViews: number;
  activeShares: number;
}

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
    const params = new URLSearchParams({
      video: demo.videoUrl,
      ...(demo.startTime && { startTime: demo.startTime }),
      ...(demo.endTime && { endTime: demo.endTime }),
      title: demo.title || "",
      description: demo.description || "",
    });

    if (demo.editing) {
      if (demo.editing.segments) {
        params.append("segments", JSON.stringify(demo.editing.segments));
      }
      if (demo.editing.zoom) {
        params.append("zoom", JSON.stringify(demo.editing.zoom));
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

    router.push(`/editor?${params.toString()}`);
  };
  const isLoading = false;

  const demos = initialDemos;

  return (
    <div
      className="flex-1 p-2 sm:p-4 md:p-8 bg-[#F1ECFF] dark:bg-[#05050d] min-h-screen mt-2 sm:mt-0 pt-2 sm:pt-0 transition-colors duration-300"
      style={{ fontFamily: "var(--font-raleway)" }}
    >
      <style jsx>{`
        @keyframes starBlink {
          0%,
          100% {
            transform: scale(1) rotate(0deg);
            opacity: 1;
          }
          25% {
            transform: scale(0.8) rotate(90deg);
            opacity: 0.7;
          }
          50% {
            transform: scale(1.2) rotate(180deg);
            opacity: 1;
          }
          75% {
            transform: scale(0.9) rotate(270deg);
            opacity: 0.8;
          }
        }

        .star-blink {
          animation: starBlink 2s ease-in-out infinite;
        }

        /* AI Orb Animations */
        .ai-orb-container {
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 2rem;
          animation: ai-orb-float 4s ease-in-out infinite;
          position: relative;
        }
        .ai-orb-svg {
          filter: drop-shadow(0 0 18px #bcb3f7);
          z-index: 1;
        }
        .ai-orb-main {
          filter: blur(0.5px);
          animation: ai-orb-pulse 2.5s ease-in-out infinite alternate;
        }
        .ai-orb-glow {
          filter: blur(10px);
          opacity: 0.6;
          animation: ai-orb-glow 3s ease-in-out infinite alternate;
        }
        .ai-orb-aura {
          stroke: #bcb3f7;
          opacity: 0.3;
          transform-origin: 50% 50%;
          animation: ai-orb-aura-expand 2.8s ease-in-out infinite;
        }
        @keyframes ai-orb-float {
          0% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-7px);
          }
          100% {
            transform: translateY(0);
          }
        }
        @keyframes ai-orb-pulse {
          0% {
            filter: blur(0.5px);
          }
          100% {
            filter: blur(2.5px);
          }
        }
        @keyframes ai-orb-glow {
          0% {
            opacity: 0.6;
          }
          100% {
            opacity: 0.9;
          }
        }
        @keyframes ai-orb-aura-expand {
          0% {
            opacity: 0.3;
            transform: scale(1);
          }
          50% {
            opacity: 0.12;
            transform: scale(1.15);
          }
          100% {
            opacity: 0.3;
            transform: scale(1);
          }
        }
        /* Modern sparkles */
        .ai-orb-sparkle {
          opacity: 0.8;
          filter: blur(0.2px);
          transform-origin: 50% 50%;
          animation-timing-function: linear;
        }
        .sparkle1 {
          animation: sparkle-orbit1 3.2s linear infinite;
        }
        .sparkle2 {
          animation: sparkle-orbit2 2.7s linear infinite;
        }
        .sparkle3 {
          animation: sparkle-orbit3 2.9s linear infinite;
        }
        .sparkle4 {
          animation: sparkle-orbit4 3.4s linear infinite;
        }
        .sparkle5 {
          animation: sparkle-orbit5 2.8s linear infinite;
        }
        .sparkle6 {
          animation: sparkle-orbit6 3.3s linear infinite;
        }
        @keyframes sparkle-orbit1 {
          0% {
            transform: rotate(0deg) translate(30px) scale(1);
            opacity: 0.8;
          }
          50% {
            opacity: 1;
          }
          100% {
            transform: rotate(360deg) translate(30px) scale(1.1);
            opacity: 0.8;
          }
        }
        @keyframes sparkle-orbit2 {
          0% {
            transform: rotate(60deg) translate(25px) scale(1);
            opacity: 0.7;
          }
          50% {
            opacity: 1;
          }
          100% {
            transform: rotate(420deg) translate(25px) scale(1.1);
            opacity: 0.7;
          }
        }
        @keyframes sparkle-orbit3 {
          0% {
            transform: rotate(120deg) translate(28px) scale(1);
            opacity: 0.6;
          }
          50% {
            opacity: 1;
          }
          100% {
            transform: rotate(480deg) translate(28px) scale(1.1);
            opacity: 0.6;
          }
        }
        @keyframes sparkle-orbit4 {
          0% {
            transform: rotate(180deg) translate(32px) scale(1);
            opacity: 0.5;
          }
          50% {
            opacity: 1;
          }
          100% {
            transform: rotate(540deg) translate(32px) scale(1.1);
            opacity: 0.5;
          }
        }
        @keyframes sparkle-orbit5 {
          0% {
            transform: rotate(240deg) translate(26px) scale(1);
            opacity: 0.7;
          }
          50% {
            opacity: 1;
          }
          100% {
            transform: rotate(600deg) translate(26px) scale(1.1);
            opacity: 0.7;
          }
        }
        @keyframes sparkle-orbit6 {
          0% {
            transform: rotate(300deg) translate(29px) scale(1);
            opacity: 0.6;
          }
          50% {
            opacity: 1;
          }
          100% {
            transform: rotate(660deg) translate(29px) scale(1.1);
            opacity: 0.6;
          }
        }
      `}</style>
      <div className="mb-4 sm:mb-6 md:mb-8">
        <h2 className="sub-heading text-xs sm:text-sm md:text-base lg:text-lg font-light text-gray-400 mb-3 sm:mb-4">
          Here&apos;s what happening with your demos today
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-6">
          <div
            className={`card bg-[#261753]/6 dark:bg-[#0a0914] border border-transparent dark:border-[rgba(255,255,255,0.08)] rounded-xl p-3 sm:p-4 md:p-6 flex flex-col items-start shadow-sm dark:shadow-[0_0_35px_rgba(0,0,0,0.35)] min-h-[100px] sm:min-h-[110px] md:min-h-[140px] cursor-pointer transition-all duration-500 ease-out hover:scale-105 sm:hover:scale-110 hover:shadow-lg transform-gpu ${
              isDark ? "stat-card" : ""
            }`}
          >
            <div className="mb-2">
              <span
                className={`card-icon inline-block bg-[#8A76FC]/[0.14] dark:bg-[rgba(255,255,255,0.06)] p-1.5 sm:p-2 rounded-lg ${
                  isDark ? "stat-icon" : ""
                }`}
              >
                {isDark ? (
                  <Play className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" />
                ) : (
                  <Image
                    src="/mingcute_play-fill.png"
                    alt="Play"
                    width={18}
                    height={18}
                    className="sm:w-6 sm:h-6 md:w-7 md:h-7"
                  />
                )}
              </span>
            </div>
            <h3 className="stat-label text-xs sm:text-sm md:text-lg font-medium text-black dark:text-[rgba(255,255,255,0.9)]">
              Total Demos
            </h3>
            <div className="stat-value text-xl sm:text-2xl md:text-3xl font-bold text-[#261753]/72 dark:text-white">
              {totalCount}
            </div>
            <div className="trend text-xs text-green-600 font-semibold mt-1 flex items-center">
              {isDark && <TrendingUp size={14} className="mr-1" />}
              <strong>+12%</strong>&nbsp;
              <span className="text-gray-500 dark:text-[rgba(255,255,255,0.5)] font-normal text-xs">
                vs last month
              </span>
            </div>
          </div>

          <div
            className={`card bg-[#9BE1F8]/14 dark:bg-[#0a0914] border border-transparent dark:border-[rgba(255,255,255,0.08)] rounded-xl p-3 sm:p-4 md:p-6 flex flex-col items-start shadow-sm dark:shadow-[0_0_35px_rgba(0,0,0,0.35)] min-h-[100px] sm:min-h-[110px] md:min-h-[140px] cursor-pointer transition-all duration-500 ease-out hover:scale-105 sm:hover:scale-110 hover:shadow-lg transform-gpu ${
              isDark ? "stat-card blue" : ""
            }`}
          >
            <div className="mb-2">
              <span
                className={`card-icon inline-block bg-[#1565D8]/12 dark:bg-[rgba(255,255,255,0.06)] p-1.5 sm:p-2 rounded-lg ${
                  isDark ? "stat-icon" : ""
                }`}
              >
                {isDark ? (
                  <Eye className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" />
                ) : (
                  <Image
                    src="/icons/dash-eye.svg"
                    alt="Views"
                    width={18}
                    height={18}
                    className="sm:w-6 sm:h-6 md:w-7 md:h-7"
                  />
                )}
              </span>
            </div>
            <h3 className="stat-label text-xs sm:text-sm md:text-lg font-medium text-black dark:text-[rgba(255,255,255,0.9)]">
              Total Views
            </h3>
            <div className="stat-value text-xl sm:text-2xl md:text-3xl font-bold text-[#261753]/72 dark:text-white">
              {totalViews}
            </div>
            <div className="trend text-xs text-green-600 font-semibold mt-1 flex items-center">
              {isDark && <TrendingUp size={14} className="mr-1" />}
              <strong>+23%</strong>&nbsp;
              <span className="text-gray-500 dark:text-[rgba(255,255,255,0.5)] font-normal text-xs">
                vs last month
              </span>
            </div>
          </div>

          <div
            className={`card bg-[#261753]/6 dark:bg-[#0a0914] border border-transparent dark:border-[rgba(255,255,255,0.08)] rounded-xl p-3 sm:p-4 md:p-6 flex flex-col items-start shadow-sm dark:shadow-[0_0_35px_rgba(0,0,0,0.35)] min-h-[100px] sm:min-h-[110px] md:min-h-[140px] cursor-pointer transition-all duration-500 ease-out hover:scale-105 sm:hover:scale-110 hover:shadow-lg transform-gpu ${
              isDark ? "stat-card" : ""
            }`}
          >
            <div className="mb-2">
              <span
                className={`card-icon inline-block bg-[#62408F]/13 dark:bg-[rgba(255,255,255,0.06)] p-1.5 sm:p-2 rounded-lg ${
                  isDark ? "stat-icon" : ""
                }`}
              >
                {isDark ? (
                  <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" />
                ) : (
                  <Image
                    src="/icons/dash-grow.svg"
                    alt="Completion Rate"
                    width={18}
                    height={18}
                    className="sm:w-6 sm:h-6 md:w-7 md:h-7"
                  />
                )}
              </span>
            </div>
            <h3 className="stat-label text-xs sm:text-sm md:text-lg font-medium text-black dark:text-[rgba(255,255,255,0.9)]">
              Completion Rate
            </h3>
            <div className="stat-value text-xl sm:text-2xl md:text-3xl font-bold text-[#261753]/72 dark:text-white">
              0%
            </div>
            <div className="trend text-xs text-green-600 font-semibold mt-1 flex items-center">
              {isDark && <TrendingUp size={14} className="mr-1" />}
              <strong>+5%</strong>&nbsp;
              <span className="text-gray-500 dark:text-[rgba(255,255,255,0.5)] font-normal text-xs">
                vs last month
              </span>
            </div>
          </div>

          <div
            className={`card bg-[#DE610E]/10 dark:bg-[#0a0914] border border-transparent dark:border-[rgba(255,255,255,0.08)] rounded-xl p-3 sm:p-4 md:p-6 flex flex-col items-start shadow-sm dark:shadow-[0_0_35px_rgba(0,0,0,0.35)] min-h-[100px] sm:min-h-[110px] md:min-h-[140px] cursor-pointer transition-all duration-500 ease-out hover:scale-105 sm:hover:scale-110 hover:shadow-lg transform-gpu ${
              isDark ? "stat-card red" : ""
            }`}
          >
            <div className="mb-2">
              <span
                className={`card-icon inline-block bg-[#DE610E]/15 dark:bg-[rgba(255,255,255,0.06)] p-1.5 sm:p-2 rounded-lg ${
                  isDark ? "stat-icon" : ""
                }`}
              >
                {isDark ? (
                  <Share2 className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" />
                ) : (
                  <Image
                    src="/icons/share.png"
                    alt="Shares"
                    width={18}
                    height={18}
                    className="sm:w-6 sm:h-6 md:w-7 md:h-7"
                  />
                )}
              </span>
            </div>
            <h3 className="stat-label text-xs sm:text-sm md:text-lg font-medium text-black dark:text-[rgba(255,255,255,0.9)]">
              Active shares
            </h3>
            <div className="stat-value text-xl sm:text-2xl md:text-3xl font-bold text-[#261753]/72 dark:text-white">
              {activeShares}
            </div>
            <div className="trend text-xs text-green-600 font-semibold mt-1 flex items-center">
              {isDark && <TrendingUp size={14} className="mr-1" />}
              <strong>+8%</strong>&nbsp;
              <span className="text-gray-500 dark:text-[rgba(255,255,255,0.5)] font-normal text-xs">
                vs last month
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:gap-4 md:gap-8">
        <div className="recent bg-white dark:bg-[#0a0914] border border-transparent dark:border-[rgba(255,255,255,0.08)] rounded-xl p-3 sm:p-4 shadow-sm dark:shadow-[0_0_35px_rgba(0,0,0,0.35)] min-h-[350px] sm:min-h-[410px] hover:shadow-lg transform flex flex-col">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0 mb-3 sm:mb-4">
            <h3 className="text-lg sm:text-xl md:text-2xl font-semibold text-[#7569A5] dark:text-white">
              Recent Demos
            </h3>
            {demos.length > 5 && (
              <button
                className="text-[#6356D7] dark:text-[#7c69ff] font-medium hover:underline text-xs sm:text-sm md:text-base cursor-pointer"
                onClick={() => router.push("/demos")}
              >
                View all
              </button>
            )}
          </div>

          <div className="flex-1 flex flex-col">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center flex-1 text-gray-500 dark:text-gray-400">
                <span>Loading demos...</span>
              </div>
            ) : demos.length > 0 ? (
              <div className="flex flex-col divide-y divide-gray-200 dark:divide-[rgba(255,255,255,0.08)] flex-1">
                {demos.slice(0, 4).map((demo: Demo) => (
                  <div key={demo.id}>
                    <div
                      className="demo-row flex flex-col sm:flex-row items-start sm:items-center justify-between py-2 sm:py-3 hover:bg-gray-50 dark:hover:bg-[rgba(255,255,255,0.04)] px-1 sm:px-2 rounded-md cursor-pointer transition gap-2 sm:gap-0"
                      onClick={() => handleEditDemo(demo)}
                    >
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                        <div className="demo-icon flex items-center justify-center bg-[#F8F6FF] dark:bg-[rgba(120,90,255,0.12)] rounded-lg w-8 h-8 sm:w-10 sm:h-10 shrink-0">
                          <Image
                            src="/icons/play-demo.svg"
                            alt="Play"
                            width={16}
                            height={16}
                            className="sm:w-5 sm:h-5"
                            style={{
                              filter: isDark ? "brightness(0) invert(1)" : "none",
                            }}
                          />
                        </div>
                        <div className="demo-text min-w-0 flex-1">
                          <div className="font-medium text-gray-800 dark:text-white text-sm sm:text-base truncate">
                            {demo.title}
                          </div>
                          <p className="text-xs sm:text-sm text-gray-500 dark:text-[rgba(255,255,255,0.5)] truncate">
                            {demo.description || "No description"}
                          </p>
                        </div>
                      </div>

                      <div className="demo-right hidden md:flex items-center gap-8 lg:gap-10 text-xs lg:text-sm text-gray-500 dark:text-[rgba(255,255,255,0.65)] shrink-0">
                        <div>Draft</div>
                        <div>{formatDate(demo.updatedAt)}</div>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="bottom-btn mt-auto flex justify-center w-full">
                  <Link href={"/recorder"}>
                    <button className="mt-3 sm:mt-4 px-3 sm:px-4 py-1.5 sm:py-2 cursor-pointer bg-[#6356D7] dark:bg-gradient-to-r dark:from-[#6c4cff] dark:to-[#8b73ff] dark:shadow-[0_0_25px_rgba(120,100,255,0.35)] text-white rounded-md font-semibold shadow hover:bg-[#7E5FFF] dark:hover:from-[#6c4cff] dark:hover:to-[#8b73ff] transition-all text-xs sm:text-sm md:text-base hover:scale-105 transform flex rounded-15 items-center gap-1.5 sm:gap-2 whitespace-nowrap">
                      <Play size={16} className="sm:w-[18px] sm:h-[18px]" />
                      Create Demo
                    </button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 px-4">
                <Image
                  src="/icons/play fill.png"
                  alt="Play"
                  width={32}
                  height={32}
                  className="sm:w-10 sm:h-10 md:w-12 md:h-12"
                  style={{
                    filter: isDark ? "brightness(0) invert(1)" : "none",
                  }}
                />
                <div className="text-sm sm:text-base md:text-lg font-semibold text-[#6356D7] dark:text-[#7c69ff] mt-3 sm:mt-4">
                  No demos yet
                </div>
                <div className="text-gray-500 dark:text-[rgba(255,255,255,0.5)] text-xs sm:text-sm mt-1 text-center">
                  Create your first demo to get started
                </div>
                <div className="bottom-btn">
                  <Link href={"/recorder"}>
                    <button className="mt-3 sm:mt-4 px-3 sm:px-4 py-1.5 sm:py-2 cursor-pointer bg-[#6356D7] dark:bg-gradient-to-r dark:from-[#6c4cff] dark:to-[#8b73ff] dark:shadow-[0_0_25px_rgba(120,100,255,0.35)] text-white rounded-md font-semibold shadow hover:bg-[#7E5FFF] dark:hover:from-[#6c4cff] dark:hover:to-[#8b73ff] transition-all text-xs sm:text-sm md:text-base hover:scale-105 transform flex items-center gap-1.5 sm:gap-2 whitespace-nowrap">
                      <Play size={16} className="sm:w-[18px] sm:h-[18px]" />
                      Create Demo
                    </button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardMain;
