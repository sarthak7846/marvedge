import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Play } from "lucide-react";
import { formatDate } from "@/app/lib/dateTimeUtils";
import { Demo } from "./types";

interface RecentDemosProps {
  demos: Demo[];
  isLoading: boolean;
  isDark: boolean;
  onViewAll: () => void;
  onEditDemo: (demo: Demo) => void;
}

const RecentDemos = ({ demos, isLoading, isDark, onViewAll, onEditDemo }: RecentDemosProps) => (
  <div className="recent bg-white dark:bg-[#0a0914] border border-transparent dark:border-[rgba(255,255,255,0.08)] rounded-xl p-3 sm:p-4 shadow-sm dark:shadow-[0_0_35px_rgba(0,0,0,0.35)] min-h-[350px] sm:min-h-[410px] hover:shadow-lg transform flex flex-col">
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0 mb-3 sm:mb-4">
      <h3 className="text-lg sm:text-xl md:text-2xl font-semibold text-[#7569A5] dark:text-white">
        Recent Demos
      </h3>
      {demos.length > 5 && (
        <button
          className="text-[#6356D7] dark:text-[#7c69ff] font-medium hover:underline text-xs sm:text-sm md:text-base cursor-pointer"
          onClick={onViewAll}
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
        <DemoList demos={demos} isDark={isDark} onEditDemo={onEditDemo} />
      ) : (
        <EmptyDemos isDark={isDark} />
      )}
    </div>
  </div>
);

interface DemoListProps {
  demos: Demo[];
  isDark: boolean;
  onEditDemo: (demo: Demo) => void;
}

const DemoList = ({ demos, isDark, onEditDemo }: DemoListProps) => (
  <div className="flex flex-col divide-y divide-gray-200 dark:divide-[rgba(255,255,255,0.08)] flex-1">
    {demos.slice(0, 4).map((demo: Demo) => (
      <div key={demo.id}>
        <div
          className="demo-row flex flex-col sm:flex-row items-start sm:items-center justify-between py-2 sm:py-3 hover:bg-gray-50 dark:hover:bg-[rgba(255,255,255,0.04)] px-1 sm:px-2 rounded-md cursor-pointer transition gap-2 sm:gap-0"
          onClick={() => onEditDemo(demo)}
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
);

const EmptyDemos = ({ isDark }: { isDark: boolean }) => (
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
);

export default RecentDemos;
