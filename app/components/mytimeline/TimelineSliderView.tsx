import { Card } from "../ui/card";
import { TimelineSliderProps } from "./types";
import { TimelineSliderVm } from "./useTimelineSlider";
import { SliderToolbar } from "./SliderToolbar";
import { SegmentButtons } from "./SegmentButtons";
import { TimelineSvg } from "./TimelineSvg";

export function TimelineSliderView(props: TimelineSliderProps & TimelineSliderVm) {
  return (
    <Card className="p-6 w-full max-w-6xl border-2 border-[#E6E1FA] shadow-lg">
      <div className="space-y-6">
        {props.progress > 0 && props.progress < 100 && (
          <div className="w-full h-2 bg-gray-200 rounded mb-2 overflow-hidden">
            <div
              className="h-full bg-[#7C5CFC] transition-all"
              style={{ width: `${props.progress}%` }}
            />
          </div>
        )}
        <SliderToolbar {...props} />
        <SegmentButtons {...props} />
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-muted-foreground">
            Timeline Duration: {props.timeFormatter(props.duration || 80.0)}
          </div>
          <div className="text-lg font-mono">StartTime : {props.timeFormatter(props.start)}</div>
          <div className="text-lg font-mono">EndTime : {props.timeFormatter(props.end)}</div>
          <div className="text-sm font-medium text-[#7C5CFC]">
            Active: Segment {props.activeIdx + 1}
          </div>
        </div>
        <TimelineSvg {...props} />
      </div>
    </Card>
  );
}
