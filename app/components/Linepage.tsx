import React from "react";

interface TimelineProps {
  minValue?: number;
  maxValue?: number;
  zoomLevel?: number;
  width?: number;
  setMode: React.Dispatch<React.SetStateAction<"main" | "trim" | "zoom" | "text">>;
  setActiveZoomIdx: React.Dispatch<React.SetStateAction<number>>;
  setActiveSegment: React.Dispatch<React.SetStateAction<number>>;
}

const Linepage = ({
  minValue = 0,
  maxValue = 5,
  zoomLevel = 1,
  width = 800,
  setMode,
  setActiveZoomIdx,
  setActiveSegment,
}: TimelineProps) => {
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);

    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const generateTicks = () => {
    const ticks: { value: number; type: string; label?: string }[] = [];

    const totalRange = maxValue - minValue;
    const targetTickCount = 8 * zoomLevel;
    const roughStep = totalRange / targetTickCount;

    const majorStep = Math.max(1, Math.round(roughStep));

    let divisions = 5;
    if (zoomLevel > 3) {
      divisions = 7;
    }
    if (zoomLevel > 6) {
      divisions = 9;
    }
    if (zoomLevel > 10) {
      divisions = 11;
    }

    const minorStep = majorStep / (divisions - 1);
    const midIndex = Math.floor(divisions / 2);

    const startMajorTick = Math.ceil(minValue / majorStep) * majorStep;

    for (let v = startMajorTick; v <= maxValue; v += majorStep) {
      ticks.push({ value: v, type: "major", label: formatTime(v) });

      for (let i = 1; i < divisions; i++) {
        const tickVal = v + i * minorStep;
        if (tickVal < v + majorStep && tickVal < maxValue) {
          ticks.push({
            value: tickVal,
            type: i === midIndex ? "middle" : "minor",
          });
        }
      }
    }

    return ticks;
  };

  const ticks = generateTicks();

  return (
    <div
      className="sticky top-0 bg-white dark:bg-[#0a081a] h-[38px] z-30 select-none border-b border-[#A594F9] dark:border-[#3e2fd9]/50"
      style={{ width }}
      onClick={() => {
        setMode("main");
        setActiveZoomIdx(-1);
        setActiveSegment(-1);
      }}
    >
      {ticks.map((tick, index) => {
        const padding = 20;
        const paddedWidth = width - padding * 2;
        const positionPx =
          padding + ((tick.value - minValue) / (maxValue - minValue)) * paddedWidth;

        return (
          <div
            key={`${tick.type}-${index}`}
            className="absolute flex flex-col items-center"
            style={{
              left: `${positionPx}px`,
              transform: "translateX(-50%)",
            }}
          >
            <div
              className={`bg-[#A594F9] mx-auto ${
                tick.type === "major"
                  ? "w-0.5 h-6"
                  : tick.type === "middle"
                    ? "w-0.5 h-5"
                    : "w-px h-3"
              }`}
            />
            {tick.type === "major" && (
              <span className="text-xs text-[#5c4cb4] dark:text-[#c4b5fd] font-medium mt-1 whitespace-nowrap">
                {tick.label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default Linepage;
