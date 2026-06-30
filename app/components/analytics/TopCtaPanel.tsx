import React from "react";
import { motion } from "framer-motion";
import { MousePointerClick } from "lucide-react";

interface TopCtaPanelProps {
  topCtas: { label: string; clicks: number }[];
}

const TopCtaPanel = ({ topCtas }: TopCtaPanelProps) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    whileHover={{ scale: 1.01 }}
    transition={{ duration: 0.6, ease: "easeOut", delay: 0.5 }}
    className="panel bg-[#FBF9FF] rounded-[20px] p-8 shadow-sm min-h-[350px] flex flex-col"
  >
    <div className="mb-6">
      <h2 className="text-[22px] font-semibold text-[#2D2154] leading-tight">Top performing CTA</h2>
      <p className="text-base text-[#8C82B4] mt-1">Your most clicked calls-to-action</p>
    </div>
    <div className="flex-1 flex flex-col gap-3">
      {topCtas.length > 0 ? (
        topCtas.map((cta, i) => (
          <div
            key={i}
            className="cta-item flex justify-between items-center bg-white border border-[#E5DCFF] rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3">
              <div className="rank w-8 h-8 rounded-full bg-[#EAE5FB] flex items-center justify-center text-[#8A76FC] font-semibold">
                {i + 1}
              </div>
              <p className="cta-name font-medium text-[#2D2154] truncate max-w-[200px] md:max-w-[250px]">
                {cta.label}
              </p>
            </div>
            <div className="clicks flex items-center gap-1.5 text-[#6356D7] bg-[#F4F1FD] px-3 py-1 rounded-full">
              <MousePointerClick size={14} />
              <span className="font-semibold text-sm">{cta.clicks} clicks</span>
            </div>
          </div>
        ))
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
          <div className="bg-[#F6F3FF] p-4 rounded-full">
            <MousePointerClick className="w-5 h-5 md:w-6 md:h-6 text-[#8A76FC]" />
          </div>
          <p className="no-data text-[#7569A5] font-semibold text-base">No CTA clicks yet</p>
          <p className="text-base text-[#8C82B4]">
            Add CTAs to your demos to start tracking clicks
          </p>
        </div>
      )}
    </div>
  </motion.div>
);

export default TopCtaPanel;
