"use client";
import { TimelineRulerProps } from "./timeline-ruler/types";
import { useTimelineRuler } from "./timeline-ruler/useTimelineRuler";
import { TimelineRulerView } from "./timeline-ruler/TimelineRulerView";

export default function TimelineRuler(props: TimelineRulerProps) {
  const vm = useTimelineRuler(props);
  return <TimelineRulerView {...props} {...vm} />;
}
