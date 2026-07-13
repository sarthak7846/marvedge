import React from "react";
import { motion } from "framer-motion";
import { Eye, MousePointerClick, CheckCircle2 } from "lucide-react";

interface TopDemosPanelProps {
  topDemos: { title: string; views: number; ctaClicks: number; hasCta: boolean }[];
}

const TopDemosPanel = ({ topDemos }: TopDemosPanelProps) => (
  <motion.div
    initial={{ opacity: 0, y: 24 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, ease: "easeOut", delay: 0.35 }}
    className="panel flex min-h-[400px] flex-col rounded-[15px] bg-white p-6 shadow-sm md:p-8"
  >
    <h2 className="text-[26px] font-semibold leading-tight text-[#261753] md:text-[32px]">
      Top performing Demos
    </h2>
    <p className="mt-1 text-base text-[rgba(0,0,0,0.51)] md:text-xl">
      Your best performing demos this month
    </p>

    <div className="mt-6 flex flex-1 flex-col gap-3">
      {topDemos.length > 0 ? (
        topDemos.map((demo, i) => (
          <div
            key={i}
            className="demo-item flex items-center justify-between rounded-xl border border-[#E5DCFF] bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="rank flex h-8 w-8 items-center justify-center rounded-full bg-[#EAE5FB] font-semibold text-[#8A76FC]">
                {i + 1}
              </div>
              <p className="demo-name max-w-[120px] truncate font-medium text-[#2D2154] md:max-w-[180px]">
                {demo.title}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="views flex items-center gap-1.5 rounded-full bg-[#F4F1FD] px-3 py-1 text-[#6356D7]">
                <Eye size={14} />
                <span className="text-sm font-semibold">{demo.views} views</span>
              </div>
              {demo.hasCta ? (
                <div className="flex items-center gap-1.5 rounded-full bg-[#EAE5FB] px-3 py-1 text-[#8A76FC] dark:border dark:border-[rgba(126,75,255,0.32)] dark:bg-[rgba(72,28,152,0.22)] dark:text-[#9c6cff]">
                  <MousePointerClick size={14} />
                  <span className="text-sm font-semibold">{demo.ctaClicks} clicks</span>
                </div>
              ) : (
                <span className="max-w-[160px] text-right text-xs text-[#8C82B4]">
                  No CTA added yet. Add a CTA to start tracking clicks.
                </span>
              )}
            </div>
          </div>
        ))
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(138,118,252,0.25)]">
            <CheckCircle2 className="h-7 w-7 text-[#8A76FC]" />
          </div>
          <p className="text-2xl font-semibold text-[rgba(38,23,83,0.66)]">No Analytics yet</p>
          <p className="text-base text-[rgba(38,23,83,0.51)] md:text-xl">
            Create and share demos to share performance data
          </p>
        </div>
      )}
    </div>
  </motion.div>
);

export default TopDemosPanel;
