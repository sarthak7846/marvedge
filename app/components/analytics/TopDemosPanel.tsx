import React from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { Eye } from "lucide-react";

interface TopDemosPanelProps {
  topDemos: { title: string; views: number }[];
}

const TopDemosPanel = ({ topDemos }: TopDemosPanelProps) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    whileHover={{ scale: 1.01 }}
    transition={{ duration: 0.6, ease: "easeOut", delay: 0.4 }}
    className="panel bg-[#FBF9FF] rounded-[20px] p-8 shadow-sm min-h-[350px] flex flex-col"
  >
    <div className="mb-6">
      <h2 className="text-[22px] font-semibold text-[#2D2154] leading-tight">
        Top performing Demos
      </h2>
      <p className="text-base text-[#8C82B4] mt-1">Your most viewed demos</p>
    </div>
    <div className="flex-1 flex flex-col gap-3">
      {topDemos.length > 0 ? (
        topDemos.map((demo, i) => (
          <div
            key={i}
            className="demo-item flex justify-between items-center bg-white border border-[#E5DCFF] rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3">
              <div className="rank w-8 h-8 rounded-full bg-[#EAE5FB] flex items-center justify-center text-[#8A76FC] font-semibold">
                {i + 1}
              </div>
              <p className="demo-name font-medium text-[#2D2154] truncate max-w-[200px] md:max-w-[250px]">
                {demo.title}
              </p>
            </div>
            <div className="views flex items-center gap-1.5 text-[#6356D7] bg-[#F4F1FD] px-3 py-1 rounded-full">
              <Eye size={14} />
              <span className="font-semibold text-sm">{demo.views} views</span>
            </div>
          </div>
        ))
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
          <div className="bg-[#F6F3FF] p-4 rounded-full">
            <Image
              src="/icons/ana-tick.svg"
              alt="Notifications"
              width={20}
              height={20}
              className="md:w-6 md:h-6"
            />
          </div>
          <p className="no-data text-[#7569A5] font-semibold text-base">No Analytics yet</p>
          <p className="text-base text-[#8C82B4]">Create and share demos to see performance data</p>
        </div>
      )}
    </div>
  </motion.div>
);

export default TopDemosPanel;
