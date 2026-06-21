import React from "react";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface ViewsOverTimePanelProps {
  viewsOverTime: { date: string; views: number }[];
}

const ViewsOverTimePanel = ({ viewsOverTime }: ViewsOverTimePanelProps) => {
  const chartData = viewsOverTime.length ? viewsOverTime : [{ date: "No data", views: 0 }];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
      className="panel bg-[#FBF9FF] rounded-[20px] p-8 shadow-sm min-h-[350px] flex flex-col"
    >
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h2 className="text-[22px] font-semibold text-[#2D2154] leading-tight">
            Views over time
          </h2>
          <p className="text-base text-[#8C82B4] mt-1">Demo views tracking</p>
        </div>
        <select className="range-btn border border-[#E5DCFF] text-sm text-[#2D2154] rounded-lg px-3 py-1.5 bg-white outline-none">
          <option>Past 30 days</option>
          <option>Past 3 months</option>
          <option>Past 1 year</option>
        </select>
      </div>
      <div className="flex-1 w-full h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5DCFF" />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#8C82B4", fontSize: 12 }}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#8C82B4", fontSize: 12 }}
              dx={-10}
            />
            <Tooltip
              contentStyle={{
                borderRadius: "12px",
                border: "none",
                boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
              }}
              labelStyle={{
                color: "#8C82B4",
                fontWeight: 600,
                marginBottom: "4px",
              }}
            />
            <Line
              type="monotone"
              dataKey="views"
              stroke="#8A76FC"
              strokeWidth={4}
              dot={{
                r: 4,
                fill: "#8A76FC",
                strokeWidth: 2,
                stroke: "#fff",
              }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
};

export default ViewsOverTimePanel;
