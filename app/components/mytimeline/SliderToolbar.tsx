import Image from "next/image";
import { Button } from "../ui/button";
import { TrimSegment } from "./types";

export function SliderToolbar({
  handleToggleZoom,
  zoomed,
  handleTrim,
  processing,
  segments,
  addSegment,
  removeSegment,
  activeIdx,
  handleUndo,
  handleRedo,
  removedSegments,
  onResetVideo,
  hasBeenTrimmed,
}: {
  handleToggleZoom: () => void;
  zoomed: boolean;
  handleTrim: () => void;
  processing: boolean;
  segments: TrimSegment[];
  addSegment: () => void;
  removeSegment: (idx: number) => void;
  activeIdx: number;
  handleUndo: () => void;
  handleRedo: () => void;
  removedSegments: TrimSegment[];
  onResetVideo?: () => void;
  hasBeenTrimmed: boolean;
}) {
  return (
    <div className="flex flex-row flex-wrap gap-2 sm:gap-4 mb-4 w-full">
      <div className="flex gap-2 sm:gap-4">
        <Button
          variant="outline"
          onClick={handleToggleZoom}
          className="min-w-[90px] h-8 px-3 flex items-center gap-2 font-semibold text-sm"
        >
          <span className="flex items-center gap-2">
            <Image
              src="/icons/zoom-new.png"
              alt="Zoom"
              width={20}
              height={20}
              className="w-5 h-5"
            />
            {zoomed ? "Zoom in" : "Zoom in"}
          </span>
        </Button>
        <Button
          onClick={handleTrim}
          disabled={processing || segments.some((seg) => seg.start >= seg.end)}
          className="min-w-[90px] h-8 px-3 flex items-center gap-2 font-semibold disabled:opacity-60 bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm"
        >
          <span className="flex items-center gap-2">
            <Image
              src="/icons/trim-new.svg"
              alt="Trim"
              width={20}
              height={20}
              className="w-5 h-5"
            />
            Trim & Merge
          </span>
        </Button>
        <Button
          onClick={addSegment}
          className="min-w-[90px] h-8 px-3 flex items-center gap-2 font-semibold bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm"
        >
          <span className="flex items-center gap-2">
            <Image src="/icons/+.svg" alt="Add" width={20} height={20} className="w-5 h-5" />
            Add Segment
          </span>
        </Button>
        <Button
          onClick={() => removeSegment(activeIdx)}
          disabled={segments.length <= 1}
          className="min-w-[90px] h-8 px-3 flex items-center gap-2 font-semibold bg-gray-200 hover:bg-gray-300 text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          <span className="flex items-center gap-2">
            <Image src="/icons/-.svg" alt="Remove" width={20} height={20} className="w-5 h-5" />
            Remove Segment
          </span>
        </Button>
      </div>
      <div className="flex-1"></div>
      <div className="flex gap-2 sm:gap-4">
        <Button
          onClick={handleUndo}
          disabled={segments.length <= 1}
          className="min-w-[50px] h-8 px-3 flex items-center justify-center font-semibold bg-gray-200 hover:bg-gray-300 text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Image src="/icons/undo.svg" alt="Undo" width={20} height={20} className="w-5 h-5" />
        </Button>
        <Button
          onClick={handleRedo}
          disabled={removedSegments.length === 0}
          className="min-w-[50px] h-8 px-3 flex items-center justify-center font-semibold bg-gray-200 hover:bg-gray-300 text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Image src="/icons/redo.svg" alt="Redo" width={20} height={20} className="w-5 h-5" />
        </Button>
        {onResetVideo && hasBeenTrimmed && (
          <Button
            variant="outline"
            onClick={onResetVideo}
            className="min-w-[90px] h-8 px-3 flex items-center gap-2 font-semibold text-sm"
          >
            <span className="flex items-center gap-2">
              <Image
                src="/icons/reset.png"
                alt="Reset"
                width={20}
                height={20}
                className="w-5 h-5"
              />
              Reset Video
            </span>
          </Button>
        )}
      </div>
    </div>
  );
}
