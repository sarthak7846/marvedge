import React from "react";
import Image from "next/image";
import { ZoomEffect } from "../../types/editor/zoom-effect";
import { EditorAction } from "./types";

type TimelineMode = "main" | "trim" | "zoom" | "text";

function ToolbarLeft({
  handleZoomClick,
  handleSmartTrim,
  processing,
  onResetVideo,
  hasTimelineEdits,
  zoomLevel,
  setZoomLevel,
}: {
  handleZoomClick: () => void;
  handleSmartTrim: () => void;
  processing: boolean;
  onResetVideo?: () => void;
  hasTimelineEdits: boolean;
  zoomLevel: number;
  setZoomLevel: React.Dispatch<React.SetStateAction<number>>;
}) {
  return (
    <div className="flex gap-3 sm:gap-4 items-center">
      <button
        onClick={handleZoomClick}
        className="btn-toolbar-item h-[50.85px] w-[111.71px] px-4 flex items-center justify-center gap-1 font-medium bg-white text-[#8A76FC] text-sm rounded-lg hover:shadow-md transition-all duration-200"
      >
        <Image src="/icons/zoooom.svg" alt="Zoom" width={26} height={26} />
        <span className="text-sm font-medium leading-none">Zoom</span>
      </button>

      <button
        onClick={handleSmartTrim}
        disabled={processing}
        className="btn-toolbar-item h-[50.85px] w-[111.71px] px-4 flex items-center justify-center gap-2 font-medium bg-white text-[#8A76FC] text-sm rounded-lg hover:shadow-md transition-all duration-200"
      >
        <Image src="/icons/trim-new.svg" alt="Trim" width={16} height={16} />
        <span className="text-sm font-medium leading-none"> Trim </span>
      </button>

      {onResetVideo && hasTimelineEdits && (
        <button
          onClick={onResetVideo}
          className="btn-toolbar-item h-[50.85px] w-[163px] px-4 flex items-center justify-center gap-2 font-medium bg-white text-[#8A76FC] text-sm rounded-lg hover:shadow-md transition-all duration-200"
        >
          <span className="text-sm font-medium leading-none"> Reset Timeline </span>
        </button>
      )}

      <div className="zoom-slider-housing flex items-center gap-2 px-3 py-2 bg-gray-100/80 rounded-lg backdrop-blur-sm ">
        <button
          onClick={() => setZoomLevel((prev) => Math.max(1, prev * 0.8))}
          className="text-gray-600 hover:text-purple-600 hover:bg-white rounded p-1 transition-colors dark:text-white dark:hover:bg-white/10"
          title="Zoom out"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>

        <input
          type="range"
          min="1"
          max="20"
          step="0.1"
          value={zoomLevel}
          onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
          style={{
            background: `linear-gradient(to right, #8A76FC ${
              ((zoomLevel - 1) / (20 - 1)) * 100
            }%, #E9D8FD ${((zoomLevel - 1) / (20 - 1)) * 100}%)`,
          }}
          className="
                w-[170px] h-[13px]
                rounded-full appearance-none cursor-pointer

            [&::-webkit-slider-runnable-track]:h-2
            [&::-webkit-slider-runnable-track]:rounded-full

            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-white
            [&::-webkit-slider-thumb]:border-2
            [&::-webkit-slider-thumb]:border-[#8A76FC]
            [&::-webkit-slider-thumb]:shadow
            [&::-webkit-slider-thumb]:cursor-pointer
            [&::-webkit-slider-thumb]:relative
            [&::-webkit-slider-thumb]:z-10
            [&::-webkit-slider-thumb]:-mt-1

            [&::-moz-range-track]:h-2
            [&::-moz-range-track]:rounded-full
            [&::-moz-range-track]:bg-purple-200

            [&::-moz-range-progress]:h-2
            [&::-moz-range-progress]:rounded-full
            [&::-moz-range-progress]:bg-[#8A76FC]

            accent-[#8A76FC]
          "
        />

        <button
          onClick={() => setZoomLevel((prev) => Math.min(20, prev * 1.25))}
          className="text-gray-600 hover:text-purple-600 hover:bg-white rounded p-1 transition-colors dark:text-white dark:hover:bg-white/10"
          title="Zoom in"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function ToolbarRight({
  playbackSpeed,
  setPlaybackSpeed,
  mode,
  activeSegment,
  segments,
  removeSegment,
  activeZoomIdx,
  zoomSegments,
  removeZoomSegment,
  selectedTextOverlayId,
  removeTextOverlay,
  handleUndo,
  undoStack,
  handleRedo,
  redoStack,
}: {
  playbackSpeed: number;
  setPlaybackSpeed: (v: number) => void;
  mode: TimelineMode;
  activeSegment: number;
  segments: { start: number; end: number }[];
  removeSegment: (idx: number) => void;
  activeZoomIdx: number;
  zoomSegments: ZoomEffect[];
  removeZoomSegment: (idx: number) => void;
  selectedTextOverlayId: string | null;
  removeTextOverlay: (id: string) => void;
  handleUndo: () => void;
  undoStack: EditorAction[];
  handleRedo: () => void;
  redoStack: EditorAction[];
}) {
  return (
    <div className="flex gap-2 sm:gap-3 items-center">
      <div className="btn-toolbar-item h-[51px] px-3 flex items-center justify-center bg-white rounded-lg border border-[#E6E1FA]">
        <select
          value={String(playbackSpeed)}
          onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
          className="h-[36px] bg-transparent text-sm text-[#7C5CFC] font-medium focus:outline-none cursor-pointer dark:text-white [&>option]:dark:bg-[#0a081a]"
          title="Playback speed"
        >
          <option value="0.75">0.75x</option>
          <option value="1">1x</option>
          <option value="1.25">1.25x</option>
          <option value="1.5">1.5x</option>
          <option value="1.75">1.75x</option>
          <option value="2">2x</option>
        </select>
      </div>

      <button
        onClick={() => {
          if (mode === "trim" && activeSegment >= 0 && activeSegment < segments.length) {
            removeSegment(activeSegment);
          } else if (mode === "zoom" && activeZoomIdx >= 0 && activeZoomIdx < zoomSegments.length) {
            removeZoomSegment(activeZoomIdx);
          } else if (mode === "text" && selectedTextOverlayId) {
            removeTextOverlay(selectedTextOverlayId);
          }
        }}
        disabled={
          mode === "main" ||
          (mode === "trim" && (segments.length === 0 || activeSegment === -1)) ||
          (mode === "zoom" && (zoomSegments.length === 0 || activeZoomIdx === -1)) ||
          (mode === "text" && !selectedTextOverlayId)
        }
        className="btn-toolbar-item h-[51px] w-[51px] px-3 flex items-center justify-center font-medium bg-white hover:bg-gray-50 text-gray-700 text-sm rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        title="Delete"
      >
        <Image
          src="/icons/Vector (1) copy.svg"
          alt="delete_icon"
          width={18.67}
          height={21}
          className="dark:brightness-0 dark:invert"
        />
      </button>
      <button
        onClick={handleUndo}
        disabled={undoStack.length === 0}
        className="btn-toolbar-item h-[51px] w-[51px] px-3 flex items-center justify-center font-medium bg-white hover:bg-gray-50 text-gray-700 text-sm rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        title="Undo"
      >
        <Image
          src="/icons/undo.svg"
          alt="Undo"
          width={18.41}
          height={14.71}
          className="dark:brightness-0 dark:invert"
        />
      </button>
      <button
        onClick={handleRedo}
        disabled={redoStack.length === 0}
        className="btn-toolbar-item h-[51px] w-[51px] px-3 flex items-center justify-center font-medium bg-white hover:bg-gray-50 text-gray-700 text-sm rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        title="Redo"
      >
        <Image
          src="/icons/redo.svg"
          alt="Redo"
          width={18.41}
          height={14.71}
          className="dark:brightness-0 dark:invert"
        />
      </button>
    </div>
  );
}

export function TimelineToolbar(props: {
  handleZoomClick: () => void;
  handleSmartTrim: () => void;
  processing: boolean;
  onResetVideo?: () => void;
  hasTimelineEdits: boolean;
  zoomLevel: number;
  setZoomLevel: React.Dispatch<React.SetStateAction<number>>;
  playbackSpeed: number;
  setPlaybackSpeed: (v: number) => void;
  mode: TimelineMode;
  activeSegment: number;
  segments: { start: number; end: number }[];
  removeSegment: (idx: number) => void;
  activeZoomIdx: number;
  zoomSegments: ZoomEffect[];
  removeZoomSegment: (idx: number) => void;
  selectedTextOverlayId: string | null;
  removeTextOverlay: (id: string) => void;
  handleUndo: () => void;
  undoStack: EditorAction[];
  handleRedo: () => void;
  redoStack: EditorAction[];
}) {
  return (
    <div className="flex flex-row items-center justify-between w-full mb-6 gap-3 sm:gap-6 ">
      <ToolbarLeft
        handleZoomClick={props.handleZoomClick}
        handleSmartTrim={props.handleSmartTrim}
        processing={props.processing}
        onResetVideo={props.onResetVideo}
        hasTimelineEdits={props.hasTimelineEdits}
        zoomLevel={props.zoomLevel}
        setZoomLevel={props.setZoomLevel}
      />
      <ToolbarRight
        playbackSpeed={props.playbackSpeed}
        setPlaybackSpeed={props.setPlaybackSpeed}
        mode={props.mode}
        activeSegment={props.activeSegment}
        segments={props.segments}
        removeSegment={props.removeSegment}
        activeZoomIdx={props.activeZoomIdx}
        zoomSegments={props.zoomSegments}
        removeZoomSegment={props.removeZoomSegment}
        selectedTextOverlayId={props.selectedTextOverlayId}
        removeTextOverlay={props.removeTextOverlay}
        handleUndo={props.handleUndo}
        undoStack={props.undoStack}
        handleRedo={props.handleRedo}
        redoStack={props.redoStack}
      />
    </div>
  );
}
