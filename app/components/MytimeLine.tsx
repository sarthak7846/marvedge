"use client";
import { TimelineSliderProps } from "./mytimeline/types";
import { useTimelineSlider } from "./mytimeline/useTimelineSlider";
import { TimelineSliderView } from "./mytimeline/TimelineSliderView";

export function TimelineSlider(props: TimelineSliderProps) {
  const vm = useTimelineSlider(props);
  return <TimelineSliderView {...props} {...vm} />;
}
