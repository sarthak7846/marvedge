import { TimelineRulerProps } from "./types";
import { TimelineRulerVm } from "./useTimelineRuler";
import { TimelineToolbar } from "./TimelineToolbar";
import { TimelineTrack } from "./TimelineTrack";

export function TimelineRulerView(props: TimelineRulerProps & TimelineRulerVm) {
  return (
    <div className="w-full max-w-6xl mx-auto">
      <TimelineToolbar {...props} />
      <TimelineTrack {...props} />

      <div className="mt-2 text-center">
        <span className="timecode-footer-readout text-sm font-medium text-[#A594F9]">
          Current: {props.localValue.toFixed(2)}s
        </span>
      </div>
    </div>
  );
}
