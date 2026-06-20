import React from "react";
import { trianglePoints } from "../../lib/utils";
import { ZoomEffect } from "../../types/editor/zoom-effect";
import { TrimSegment } from "./types";
import {
  HEIGHT,
  MARGIN,
  TIMELINE_Y,
  TIMELINE_HEIGHT,
  HANDLE_WIDTH,
  HANDLE_HEIGHT,
  RULER_COLOR,
  TRIM_COLOR,
  HANDLE_COLOR,
  TICK_COLOR,
  LABEL_COLOR,
  computeTicks,
  MajorTick,
  Tick,
} from "./constants";

type TimeToX = (t: number) => number;
type Formatter = (seconds: number) => string;

function ZoomEffectMarkers({
  zoomEffects = [],
  timeToX,
  onZoomEffectRemove,
  timeFormatter,
}: {
  zoomEffects?: ZoomEffect[];
  timeToX: TimeToX;
  onZoomEffectRemove?: (id: string) => void;
  timeFormatter: Formatter;
}) {
  return (
    <>
      {zoomEffects.map((effect) => {
        const startX = timeToX(effect.startTime);
        const endX = timeToX(effect.endTime);
        const width = endX - startX;
        return (
          <g key={`zoom-${effect.id}`}>
            <rect
              x={startX}
              y={TIMELINE_Y}
              width={width}
              height={TIMELINE_HEIGHT}
              fill="rgba(124, 92, 252, 0.5)"
              stroke="rgba(124, 92, 252, 1)"
              strokeWidth={3}
              strokeDasharray="5,5"
              rx={4}
            />
            <text
              x={startX + width / 2}
              y={TIMELINE_Y - 8}
              textAnchor="middle"
              fontSize={12}
              fill="#7C5CFC"
            >
              🔍 {effect.zoomLevel.toFixed(1)}x
            </text>
            {onZoomEffectRemove && (
              <foreignObject x={startX + width / 2 + 20} y={TIMELINE_Y - 22} width={20} height={20}>
                <button
                  style={{
                    width: "20px",
                    height: "20px",
                    background: "#7C5CFC",
                    color: "white",
                    border: "none",
                    borderRadius: "50%",
                    cursor: "pointer",
                    fontSize: "12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    // console.log("Removing zoom effect:", effect.id);
                    onZoomEffectRemove(effect.id);
                  }}
                >
                  ✕
                </button>
              </foreignObject>
            )}
            <circle
              cx={startX}
              cy={TIMELINE_Y + TIMELINE_HEIGHT / 2}
              r={4}
              fill="#7C5CFC"
              stroke="white"
              strokeWidth={2}
            />
            <circle
              cx={endX}
              cy={TIMELINE_Y + TIMELINE_HEIGHT / 2}
              r={4}
              fill="#7C5CFC"
              stroke="white"
              strokeWidth={2}
            />
            <text
              x={startX}
              y={TIMELINE_Y + TIMELINE_HEIGHT + 15}
              textAnchor="middle"
              fontSize={9}
              fill="#7C5CFC"
            >
              {timeFormatter(effect.startTime)}
            </text>
            <text
              x={endX}
              y={TIMELINE_Y + TIMELINE_HEIGHT + 15}
              textAnchor="middle"
              fontSize={9}
              fill="#7C5CFC"
            >
              {timeFormatter(effect.endTime)}
            </text>
          </g>
        );
      })}
    </>
  );
}

function TimelineTicks({
  majorTicks,
  minorTicks,
  microTicks,
}: {
  majorTicks: MajorTick[];
  minorTicks: Tick[];
  microTicks: Tick[];
}) {
  return (
    <>
      {majorTicks.map((tick, i) => (
        <g key={`major-${i}`}>
          <line
            x1={tick.x}
            y1={TIMELINE_Y}
            x2={tick.x}
            y2={TIMELINE_Y + TIMELINE_HEIGHT + 20}
            stroke={TICK_COLOR}
            strokeWidth={2}
          />
          <text
            x={tick.x}
            y={TIMELINE_Y + TIMELINE_HEIGHT + 32}
            textAnchor="middle"
            fontSize={14}
            fill={LABEL_COLOR}
          >
            {tick.label}
          </text>
        </g>
      ))}
      {minorTicks.map((tick, i) => {
        if (!majorTicks.some((mt) => mt.time === tick.time)) {
          return (
            <line
              key={`minor-${i}`}
              x1={tick.x}
              y1={TIMELINE_Y}
              x2={tick.x}
              y2={TIMELINE_Y + TIMELINE_HEIGHT + 10}
              stroke={TICK_COLOR}
              strokeWidth={1}
              opacity={0.5}
            />
          );
        }
        return null;
      })}
      {microTicks.map((tick, i) => {
        if (
          !majorTicks.some((mt) => mt.time === tick.time) &&
          !minorTicks.some((mt) => mt.time === tick.time)
        ) {
          return (
            <line
              key={`micro-${i}`}
              x1={tick.x}
              y1={TIMELINE_Y}
              x2={tick.x}
              y2={TIMELINE_Y + TIMELINE_HEIGHT + 6}
              stroke={TICK_COLOR}
              strokeWidth={0.5}
              opacity={0.3}
            />
          );
        }
        return null;
      })}
    </>
  );
}

function TimelineHandles({
  timeToX,
  duration,
  timeFormatter,
  start,
  end,
  setDragging,
}: {
  timeToX: TimeToX;
  duration: number;
  timeFormatter: Formatter;
  start: number;
  end: number;
  setDragging: React.Dispatch<React.SetStateAction<null | "start" | "end">>;
}) {
  return (
    <>
      <polygon
        points={trianglePoints(
          timeToX(0),
          TIMELINE_Y + TIMELINE_HEIGHT / 2,
          HANDLE_WIDTH,
          HANDLE_HEIGHT,
          "up"
        )}
        fill={HANDLE_COLOR}
        stroke={RULER_COLOR}
        strokeWidth={2}
        opacity={0.95}
      >
        <title>Start: 0.00</title>
      </polygon>
      <text
        x={timeToX(0)}
        y={TIMELINE_Y - HANDLE_HEIGHT + 8}
        textAnchor="middle"
        fontSize={13}
        fill={LABEL_COLOR}
      >
        0.00
      </text>
      <polygon
        points={trianglePoints(
          timeToX(duration || 80.0),
          TIMELINE_Y + TIMELINE_HEIGHT / 2,
          HANDLE_WIDTH,
          HANDLE_HEIGHT,
          "up"
        )}
        fill={HANDLE_COLOR}
        stroke={RULER_COLOR}
        strokeWidth={2}
        opacity={0.95}
      >
        <title>End: {timeFormatter(duration || 80.0)}</title>
      </polygon>
      <text
        x={timeToX(duration || 80.0)}
        y={TIMELINE_Y - HANDLE_HEIGHT + 8}
        textAnchor="middle"
        fontSize={13}
        fill={LABEL_COLOR}
      >
        {timeFormatter(duration || 80.0)}
      </text>
      <g
        style={{ cursor: "ew-resize" }}
        onMouseDown={(e) => {
          // console.log("End handle mouse down");
          e.stopPropagation();
          setDragging("start");
        }}
      >
        <polygon
          points={trianglePoints(
            timeToX(start),
            TIMELINE_Y + TIMELINE_HEIGHT / 2,
            HANDLE_WIDTH,
            HANDLE_HEIGHT,
            "up"
          )}
          fill={HANDLE_COLOR}
          stroke={RULER_COLOR}
          strokeWidth={2}
          opacity={0.95}
        />
        <text
          x={timeToX(start)}
          y={TIMELINE_Y - HANDLE_HEIGHT + 8}
          textAnchor="middle"
          fontSize={13}
          fill={RULER_COLOR}
        >
          {timeFormatter(start)}
        </text>
      </g>
      <g
        style={{ cursor: "ew-resize" }}
        onMouseDown={(e) => {
          e.stopPropagation();
          setDragging("end");
        }}
      >
        <polygon
          points={trianglePoints(
            timeToX(end),
            TIMELINE_Y + TIMELINE_HEIGHT / 2,
            HANDLE_WIDTH,
            HANDLE_HEIGHT,
            "up"
          )}
          fill={HANDLE_COLOR}
          stroke={RULER_COLOR}
          strokeWidth={2}
          opacity={0.95}
        />
        <text
          x={timeToX(end)}
          y={TIMELINE_Y - HANDLE_HEIGHT + 8}
          textAnchor="middle"
          fontSize={13}
          fill={RULER_COLOR}
        >
          {timeFormatter(end)}
        </text>
      </g>
    </>
  );
}

type TimelineSvgProps = {
  svgRef: React.RefObject<SVGSVGElement | null>;
  svgWidth: number;
  duration: number;
  segments: TrimSegment[];
  activeIdx: number;
  currentTime: number;
  zoomEffects?: ZoomEffect[];
  onZoomEffectRemove?: (id: string) => void;
  timeFormatter: Formatter;
  start: number;
  end: number;
  setDragging: React.Dispatch<React.SetStateAction<null | "start" | "end">>;
  handleTimelineClick: (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => void;
};

export function TimelineSvg(props: TimelineSvgProps) {
  const {
    svgRef,
    svgWidth,
    duration,
    segments,
    activeIdx,
    currentTime,
    zoomEffects,
    onZoomEffectRemove,
    timeFormatter,
    start,
    end,
    setDragging,
    handleTimelineClick,
  } = props;

  const timeToX = (t: number) => {
    if (isNaN(t) || isNaN(duration) || duration === 0) {
      return MARGIN;
    }
    const x = MARGIN + ((svgWidth - 2 * MARGIN) * t) / duration;
    return Math.max(MARGIN, Math.min(svgWidth - MARGIN, x));
  };

  const { majorTicks, minorTicks, microTicks } = computeTicks(duration, timeToX);

  return (
    <div className="w-full flex justify-center">
      <svg
        ref={svgRef}
        width="100%"
        style={{ maxWidth: 1400, height: HEIGHT * 1.5 }}
        viewBox={`0 0 ${svgWidth} ${HEIGHT}`}
        preserveAspectRatio="none"
        onClick={handleTimelineClick}
        key={`timeline-${start}-${end}-${activeIdx}`}
      >
        {/* Ruler bar */}
        <rect
          x={MARGIN}
          y={TIMELINE_Y}
          width={svgWidth - 2 * MARGIN}
          height={TIMELINE_HEIGHT}
          rx={6}
          fill="#F6F3FF"
          stroke={RULER_COLOR}
          strokeWidth={2}
        />
        {/* Trim regions */}
        {segments.map((seg, idx) => (
          <rect
            key={idx}
            x={isNaN(seg.start) ? MARGIN : timeToX(seg.start)}
            y={TIMELINE_Y}
            width={isNaN(seg.end) || isNaN(seg.start) ? 0 : timeToX(seg.end) - timeToX(seg.start)}
            height={TIMELINE_HEIGHT}
            fill={idx === activeIdx ? TRIM_COLOR : "#D1C4E9"}
            opacity={0.7}
            rx={6}
          />
        ))}
        {/* Current time marker */}
        <line
          x1={isNaN(currentTime) ? MARGIN : timeToX(currentTime)}
          y1={TIMELINE_Y - 10}
          x2={isNaN(currentTime) ? MARGIN : timeToX(currentTime)}
          y2={TIMELINE_Y + TIMELINE_HEIGHT + 20}
          stroke={RULER_COLOR}
          strokeWidth={2}
          opacity={0.9}
        />
        {/* Zoom effects indicators */}
        <ZoomEffectMarkers
          zoomEffects={zoomEffects}
          timeToX={timeToX}
          onZoomEffectRemove={onZoomEffectRemove}
          timeFormatter={timeFormatter}
        />
        {/* Major and minor tick marks */}
        <TimelineTicks majorTicks={majorTicks} minorTicks={minorTicks} microTicks={microTicks} />
        {/* Fixed markers and start/end handles */}
        <TimelineHandles
          timeToX={timeToX}
          duration={duration}
          timeFormatter={timeFormatter}
          start={start}
          end={end}
          setDragging={setDragging}
        />
      </svg>
    </div>
  );
}
