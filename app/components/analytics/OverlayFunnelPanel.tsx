"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Filter, Info } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DemoFunnel, Funnel } from "@/app/lib/overlays/funnel";

export interface OverlayFunnelPanelProps {
  overall: Funnel;
  perDemo: DemoFunnel[];
  /** Length of the reporting window, in days. */
  windowDays: number;
}

/**
 * The overlay conversion funnel.
 *
 * Recharts, because ViewsOverTimePanel already uses it — a second charting
 * library for one panel is not a trade this page needs.
 *
 * READS THE ROLLUP ONLY. The props here are derived from PlayerEventDaily in the
 * server component; no raw PlayerEvent row reaches this page (locked decision 9).
 */

/** Bar colours, darkening down the funnel so the shape reads without the axis. */
const STAGE_COLORS = ["#8A76FC", "#7E68F5", "#7059EE", "#6E5AD8", "#5B48BC"];

/** A percentage, or an em dash when the denominator was empty. */
function ratio(value: number, comparable: boolean): string {
  return comparable ? `${value}%` : "—";
}

const OverlayFunnelPanel = ({ overall, perDemo, windowDays }: OverlayFunnelPanelProps) => {
  // "" = the workspace total. A demo id narrows to that demo.
  const [selectedDemoId, setSelectedDemoId] = useState("");

  const selected = perDemo.find((d) => d.demoId === selectedDemoId);
  const funnel = selected ? selected.funnel : overall;
  const scopeLabel = selected ? selected.title : "All demos";

  const chartData = funnel.steps.map((step, index) => ({
    label: step.label,
    count: step.count,
    ofStartPct: step.ofStartPct,
    fill: STAGE_COLORS[index] ?? STAGE_COLORS[STAGE_COLORS.length - 1],
  }));

  // THE EMPTY STATE. A workspace that has never served an overlay has zero of
  // everything, and five bars of length zero plus a column of "0%" reads as a
  // broken panel rather than as "no data yet". Say what is missing instead.
  const hasData = overall.totalEvents > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut", delay: 0.5 }}
      className="panel mt-4 flex flex-col overflow-hidden rounded-[15px] bg-white p-4 shadow-sm md:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold leading-tight text-[#261753] md:text-2xl">
            Overlay conversion funnel
          </h2>
          <p className="mt-0.5 text-sm text-[rgba(0,0,0,0.51)] md:text-base">
            {/* The timezone rule is stated where a reader sees it — see
                app/lib/overlays/rollup.ts for why days are UTC. */}
            Last {windowDays} days &middot; {scopeLabel} &middot; days are UTC
          </p>
        </div>

        {hasData && perDemo.length > 0 ? (
          <label className="flex shrink-0 items-center gap-2 text-sm text-[#6356D7]">
            <Filter size={15} aria-hidden="true" />
            <span className="sr-only">Filter funnel by demo</span>
            <select
              value={selectedDemoId}
              onChange={(event) => setSelectedDemoId(event.target.value)}
              className="max-w-[220px] truncate rounded-lg border border-[#E5DCFF] bg-[#F6F3FF] px-2.5 py-1.5 text-sm font-medium text-[#2D1F61] outline-none focus:border-[#8A76FC]"
            >
              <option value="">All demos</option>
              {perDemo.map((demo) => (
                <option key={demo.demoId} value={demo.demoId}>
                  {demo.title}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {hasData ? (
        <>
          <div className="mt-3 h-[260px] w-full rounded-[15px] bg-[rgba(197,182,241,0.09)] p-2 dark:bg-[rgba(255,255,255,0.02)]">
            <ResponsiveContainer width="100%" height="100%" minHeight={0}>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 8, right: 24, left: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5DCFF" />
                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#8C82B4", fontSize: 12 }}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={130}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#8C82B4", fontSize: 12 }}
                />
                <Tooltip
                  cursor={{ fill: "rgba(138,118,252,0.08)" }}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "none",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                  }}
                  labelStyle={{ color: "#8C82B4", fontWeight: 600, marginBottom: "4px" }}
                  formatter={(value, _name, item) => {
                    const pct = (item?.payload as { ofStartPct?: number } | undefined)?.ofStartPct;
                    return [`${value} (${pct ?? 0}% of starts)`, "Events"];
                  }}
                />
                <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={26}>
                  {chartData.map((entry) => (
                    <Cell key={entry.label} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-[#8C82B4]">
                  <th className="py-2 pr-3 font-semibold">Stage</th>
                  <th className="py-2 pr-3 text-right font-semibold">Events</th>
                  <th className="py-2 pr-3 text-right font-semibold">Of starts</th>
                  <th className="py-2 pr-3 text-right font-semibold">Of previous</th>
                  <th className="py-2 text-right font-semibold">Drop-off</th>
                </tr>
              </thead>
              <tbody>
                {funnel.steps.map((step) => (
                  <tr key={step.stage} className="border-t border-[#F0ECFF]">
                    <td className="py-2 pr-3 font-medium text-[#2D1F61]">{step.label}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-[#2D2154]">
                      {step.count.toLocaleString()}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-[#6356D7]">
                      {step.ofStartPct}%
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-[#6356D7]">
                      {ratio(step.ofPreviousPct, step.comparable)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-[rgba(38,23,83,0.66)]">
                      {step.comparable
                        ? `${step.dropOffPct}% (${step.dropOffCount.toLocaleString()})`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Not a footnote for its own sake. A reader who sees CTA clicks above
              lead submissions will otherwise assume the numbers are wrong. */}
          <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-[rgba(38,23,83,0.51)]">
            <Info size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              Stages are counted independently, so a later stage can exceed an earlier one — a demo
              with no lead gate records starts and CTA clicks but no gate views, and clicking a
              branching card navigates away before the video completes. A dash means the previous
              stage had no events to compare against.
            </span>
          </p>
        </>
      ) : (
        <div className="mt-3 flex flex-col items-center justify-center gap-2 rounded-[15px] bg-[rgba(197,182,241,0.09)] px-4 py-10 text-center dark:bg-[rgba(255,255,255,0.02)]">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[rgba(138,118,252,0.25)]">
            <Info className="h-6 w-6 text-[#8A76FC]" />
          </div>
          <p className="text-lg font-semibold text-[rgba(38,23,83,0.66)]">No overlay data yet</p>
          <p className="max-w-md text-sm text-[rgba(38,23,83,0.51)] md:text-base">
            This funnel fills in once a shared demo with overlays enabled is viewed. Turn on
            Overlays for a demo in the editor sidebar, share it, and the stages appear here the day
            after the first view.
          </p>
        </div>
      )}
    </motion.div>
  );
};

export default OverlayFunnelPanel;
