import React from "react";
import { motion } from "framer-motion";
import { Eye } from "lucide-react";
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
  const hasData = viewsOverTime.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
      className="panel flex min-h-[400px] flex-col rounded-[15px] bg-white p-6 shadow-sm md:p-8"
    >
      <h2 className="text-[26px] font-semibold leading-tight text-[#261753] md:text-[32px]">
        Views over time
      </h2>
      <p className="mt-1 text-base text-[rgba(0,0,0,0.51)] md:text-xl">
        Demo views in last 30 days
      </p>

      <div className="mt-6 flex flex-1 items-center justify-center rounded-[15px] bg-[rgba(197,182,241,0.09)] p-4 dark:bg-[rgba(255,255,255,0.02)]">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%" minHeight={320}>
            <LineChart data={viewsOverTime} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "12px",
                  border: "none",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                }}
                labelStyle={{ color: "#8C82B4", fontWeight: 600, marginBottom: "4px" }}
              />
              <Line
                type="monotone"
                dataKey="views"
                stroke="#8A76FC"
                strokeWidth={4}
                dot={{ r: 4, fill: "#8A76FC", strokeWidth: 2, stroke: "#fff" }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <Eye className="h-12 w-12 text-[rgba(138,118,252,0.5)]" strokeWidth={1.8} />
            <p className="text-2xl font-semibold text-[rgba(38,23,83,0.66)]">No view data yet</p>
            <p className="text-base text-[rgba(38,23,83,0.51)] md:text-xl">
              Showing growth trend over time
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ViewsOverTimePanel;
