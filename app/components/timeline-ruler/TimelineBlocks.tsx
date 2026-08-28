import React from "react";
import Image from "next/image";
import { Captions, Search } from "lucide-react";
import { ZoomEffect } from "../../types/editor/zoom-effect";
import {
  DragState,
  DragSubtitleState,
  DragZoomState,
  DragTextState,
  DragAudioState,
  TextOverlayItem,
} from "./types";
import type { SubtitleClusterItem, SubtitleCueItem } from "./subtitleTrackLayout";
import { AudioClipDto } from "../../types/audio";
import { ClipPlacement, getClipTimelineWindow } from "../../store/audioClipStore";
import { TIMELINE_RULER_HEIGHT } from "../Linepage";

type TimelineMode = "main" | "trim" | "zoom" | "text";

export function TrimSegmentBlock({
  segment,
  idx,
  activeSegment,
  minValue,
  maxValue,
  zoomedTimelineWidth,
  switchToTrimMode,
  playTrimSegment,
  setDragState,
  trackIdx,
}: {
  segment: { start: number; end: number };
  idx: number;
  activeSegment: number;
  minValue: number;
  maxValue: number;
  zoomedTimelineWidth: number;
  switchToTrimMode: (trimIdx: number) => void;
  playTrimSegment: (
    segment: { start: number; end: number },
    idx: number,
    e?: React.MouseEvent
  ) => void;
  setDragState: React.Dispatch<React.SetStateAction<DragState | null>>;
  trackIdx: number;
}) {
  const startPosition = ((segment.start - minValue) / (maxValue - minValue)) * zoomedTimelineWidth;
  const endPosition = ((segment.end - minValue) / (maxValue - minValue)) * zoomedTimelineWidth;
  const width = endPosition - startPosition;

  return (
    <div
      className={`absolute h-[32px] group cursor-grab transition-opacity track-red sequence-block-shape width-trim-block ${
        idx === activeSegment && activeSegment != -1
          ? "bg-[#FF3939]/54 opacity-70 z-10 hover:border-2 border-black rounded-md active"
          : "bg-[#FF3939]/35 opacity-50 hover:opacity-65 z-8"
      }`}
      style={{
        left: `${startPosition}px`,
        width: `${width}px`,
        top: `${TIMELINE_RULER_HEIGHT + trackIdx * 36}px`,
      }}
      onClick={(e) => {
        e.stopPropagation();
        switchToTrimMode(idx);
        playTrimSegment(segment, idx, e);
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        setDragState({
          mode: "segment",
          index: idx,
          startX: e.clientX,
          startY: e.clientY,
          startTrack: trackIdx,
          startValue: segment.start,
          endValue: segment.end,
        });
      }}
    >
      <div className="w-full h-full flex justify-center items-center ">
        <div className="flex items-center gap-1 px-2 py-1 bg-transparent pointer-events-none overflow-hidden">
          <Image
            src="/icons/Violet_scissor.svg"
            alt="Trim"
            width={14.89}
            height={14.89}
            className="select-none"
          />
          <div className="text-base font-bold text-[#8A76FC] select-none track-text">Trim</div>
        </div>
      </div>

      <div
        className="flex items-center justify-center absolute py-1 top-0 -left-1 h-[32px] w-[23px] bg-[#FF3939]/54 rounded-l-md group-hover:opacity-100 cursor-ew-resize transition-opacity hover:bg-[#FF3939]"
        onMouseDown={(e) => {
          e.stopPropagation();
          setDragState({
            mode: "edge",
            index: idx,
            side: "left",
            startX: e.clientX,
            startValue: segment.start,
          });
        }}
        aria-label="Resize start"
        title="Drag to resize start"
      >
        <div className="w-px h-[20px] bg-white/80" />
      </div>

      <div
        className="flex items-center justify-center absolute py-1 top-0 -right-1 h-[32px] w-[23px] bg-[#FF3939]/54 rounded-r-md group-hover:opacity-100 cursor-ew-resize transition-opacity hover:bg-[#FF3939]"
        onMouseDown={(e) => {
          e.stopPropagation();
          setDragState({
            mode: "edge",
            index: idx,
            side: "right",
            startX: e.clientX,
            startValue: segment.end,
          });
        }}
        title="Drag to resize end"
        aria-label="Resize end"
      >
        <div className="w-px h-[20px] bg-white/80" />
      </div>
    </div>
  );
}

export function ZoomSegmentBlock({
  segment,
  idx,
  activeZoomIdx,
  minValue,
  maxValue,
  zoomedTimelineWidth,
  playZoomSegment,
  setDragZoomState,
  trackIdx,
}: {
  segment: ZoomEffect;
  idx: number;
  activeZoomIdx: number;
  minValue: number;
  maxValue: number;
  zoomedTimelineWidth: number;
  playZoomSegment: (segment: ZoomEffect, idx: number, e?: React.MouseEvent) => void;
  setDragZoomState: React.Dispatch<React.SetStateAction<DragZoomState | null>>;
  trackIdx: number;
}) {
  const startPosition =
    ((segment.startTime - minValue) / (maxValue - minValue)) * zoomedTimelineWidth;
  const endPosition = ((segment.endTime - minValue) / (maxValue - minValue)) * zoomedTimelineWidth;
  const width = endPosition - startPosition;

  return (
    <div
      className={`absolute h-[32px] group cursor-grab transition-opacity track-green sequence-block-shape width-zoom-block ${
        idx == activeZoomIdx
          ? "bg-[#36B37E]/40 opacity-80 z-10 hover:border-2 border-[#36B37E] rounded-md active"
          : "bg-[#36B37E]/25 opacity-70 hover:opacity-90 z-8"
      }`}
      style={{
        left: `${startPosition}px`,
        width: `${width}px`,
        top: `${TIMELINE_RULER_HEIGHT + trackIdx * 36}px`,
      }}
      onClick={(e) => {
        e.stopPropagation();

        playZoomSegment(segment, idx, e);
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        setDragZoomState({
          mode: "segment",
          index: idx,
          startX: e.clientX,
          startY: e.clientY,
          startTrack: trackIdx,
          startValue: segment.startTime,
          endValue: segment.endTime,
        });
      }}
    >
      <div className="w-full h-full flex justify-center items-center ">
        <div className="flex items-center gap-1 px-2 py-1 bg-transparent pointer-events-none overflow-hidden">
          <Image
            src="/icons/Violet_scissor.svg"
            alt="Trim"
            width={14.89}
            height={14.89}
            className="select-none"
          />
          <div className="text-base font-bold text-[#8A76FC] select-none track-text">Zoom</div>
        </div>
      </div>

      <div
        className="flex items-center justify-center absolute py-1 top-0 -left-1 h-[32px] w-[23px] bg-[#36B37E]/80 rounded-l-md group-hover:opacity-100 cursor-ew-resize transition-opacity hover:bg-[#36B37E]"
        onMouseDown={(e) => {
          e.stopPropagation();
          setDragZoomState({
            mode: "edge",
            index: idx,
            side: "left",
            startX: e.clientX,
            startValue: segment.startTime,
          });
        }}
        aria-label="Resize start"
        title="Drag to resize start"
      >
        <div className="w-px h-[20px] bg-white/80" />
      </div>

      <div
        className="flex items-center justify-center absolute py-1 top-0 -right-1 h-[32px] w-[23px] bg-[#36B37E]/80 rounded-r-md group-hover:opacity-100 cursor-ew-resize transition-opacity hover:bg-[#36B37E]"
        onMouseDown={(e) => {
          e.stopPropagation();
          setDragZoomState({
            mode: "edge",
            index: idx,
            side: "right",
            startX: e.clientX,
            startValue: segment.endTime,
          });
        }}
        title="Drag to resize end"
        aria-label="Resize end"
      >
        <div className="w-px h-[20px] bg-white/80" />
      </div>
    </div>
  );
}

export function TextOverlayBlock({
  overlay,
  idx,
  selectedTextOverlayId,
  minValue,
  maxValue,
  zoomedTimelineWidth,
  setMode,
  setSelectedTextOverlayId,
  setTextOverlayInspectorValues,
  updateCurrentTimeFromMouse,
  setPlaying,
  setDragTextState,
  trackIdx,
}: {
  overlay: TextOverlayItem;
  idx: number;
  selectedTextOverlayId: string | null;
  minValue: number;
  maxValue: number;
  zoomedTimelineWidth: number;
  setMode: React.Dispatch<React.SetStateAction<TimelineMode>>;
  setSelectedTextOverlayId: React.Dispatch<React.SetStateAction<string | null>>;
  setTextOverlayInspectorValues: (overlay: TextOverlayItem) => void;
  updateCurrentTimeFromMouse: (e: MouseEvent | React.MouseEvent) => void;
  setPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  setDragTextState: React.Dispatch<React.SetStateAction<DragTextState | null>>;
  trackIdx: number;
}) {
  const startPosition =
    ((overlay.startTime - minValue) / (maxValue - minValue)) * zoomedTimelineWidth;
  const endPosition = ((overlay.endTime - minValue) / (maxValue - minValue)) * zoomedTimelineWidth;
  const width = Math.max(6, endPosition - startPosition);
  const isSelected = overlay.id === selectedTextOverlayId;
  const label = overlay.text?.trim() ? overlay.text.trim() : `Text ${idx + 1}`;

  return (
    <div
      className={`absolute h-[32px] group cursor-grab transition-opacity track-yellow sequence-block-shape width-text-block ${
        isSelected
          ? "bg-[#FFF4A8]/85 opacity-90 z-10 hover:border-2 border-[#B38700] rounded-md active"
          : "bg-[#FFF4A8]/65 opacity-75 hover:opacity-90 border border-[#D4A017] z-8 rounded-md"
      }`}
      style={{
        left: `${startPosition}px`,
        width: `${width}px`,
        top: `${TIMELINE_RULER_HEIGHT + trackIdx * 36}px`,
      }}
      onClick={(e) => {
        e.stopPropagation();
        setMode("text");
        setSelectedTextOverlayId(overlay.id);
        setTextOverlayInspectorValues(overlay);
        updateCurrentTimeFromMouse(e);
        setPlaying(false);
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        setDragTextState({
          mode: "segment",
          id: overlay.id,
          startX: e.clientX,
          startY: e.clientY,
          startTrack: trackIdx,
          startValue: overlay.startTime,
          endValue: overlay.endTime,
        });
      }}
    >
      <div className="w-full h-full flex justify-center items-center">
        <div className="flex items-center gap-1 px-2 py-1 bg-transparent pointer-events-none overflow-hidden max-w-full">
          <Image
            src="/icons/Violet_scissor.svg"
            alt="Text"
            width={14.89}
            height={14.89}
            className="select-none"
          />
          <div className="text-base font-bold text-[#8A76FC] select-none track-text">Text</div>
          <div className="text-xs text-[#6B5BB5] select-none truncate max-w-[180px] track-text">
            {label}
          </div>
        </div>
      </div>

      <div
        className="flex items-center justify-center absolute py-1 top-0 -left-1 h-[32px] w-[23px] bg-[#D4A017]/75 rounded-l-md group-hover:opacity-100 cursor-ew-resize transition-opacity hover:bg-[#B38700]"
        onMouseDown={(e) => {
          e.stopPropagation();
          setDragTextState({
            mode: "edge",
            id: overlay.id,
            side: "left",
            startX: e.clientX,
            startValue: overlay.startTime,
          });
        }}
        aria-label="Resize text start"
        title="Drag to resize start"
      >
        <div className="w-px h-[20px] bg-white/80" />
      </div>

      <div
        className="flex items-center justify-center absolute py-1 top-0 -right-1 h-[32px] w-[23px] bg-[#D4A017]/75 rounded-r-md group-hover:opacity-100 cursor-ew-resize transition-opacity hover:bg-[#B38700]"
        onMouseDown={(e) => {
          e.stopPropagation();
          setDragTextState({
            mode: "edge",
            id: overlay.id,
            side: "right",
            startX: e.clientX,
            startValue: overlay.endTime,
          });
        }}
        aria-label="Resize text end"
        title="Drag to resize end"
      >
        <div className="w-px h-[20px] bg-white/80" />
      </div>
    </div>
  );
}

/** Shared geometry so the subtitle blocks line up with the trim/zoom/text lanes. */
const SUBTITLE_TOP = (trackIdx: number) => `${38 + trackIdx * 36}px`;

/** Edge handle width. Two of these plus a body is SUBTITLE_MIN_BLOCK_PX. */
const SUBTITLE_HANDLE_PX = 9;

/**
 * One subtitle on the timeline (SUB-6.4): drag the body to move it, drag either
 * edge to resize it.
 *
 * Purple, so it reads as a subtitle at a glance next to the red trim, green zoom
 * and yellow text blocks it shares the ruler with.
 *
 * The handles sit INSIDE the block rather than overhanging it like the trim and
 * zoom ones do. Cues routinely butt up against each other — the transcriber
 * breaks a cue on length as often as on a pause — and overhanging handles would
 * cover the neighbour's, leaving the boundary between two adjacent cues
 * ungrabbable.
 */
export function SubtitleCueBlock({
  item,
  isSelected,
  isDragging,
  trackIdx,
  onSelect,
  setDragSubtitleState,
}: {
  item: SubtitleCueItem;
  isSelected: boolean;
  isDragging: boolean;
  trackIdx: number;
  onSelect: (index: number) => void;
  setDragSubtitleState: React.Dispatch<React.SetStateAction<DragSubtitleState | null>>;
}) {
  const { index, cue, leftPx, widthPx } = item;
  const label = cue.text.trim() || `Subtitle ${index + 1}`;

  return (
    <div
      className={`subtitle-cue-block absolute h-[32px] group cursor-grab rounded-md border transition-opacity ${
        isSelected || isDragging
          ? "bg-[#8A76FC]/55 border-[#6E5AD8] opacity-95 z-10"
          : "bg-[#A594F9]/35 border-[#A594F9]/70 opacity-80 hover:opacity-100 z-8"
      }`}
      style={{ left: `${leftPx}px`, width: `${widthPx}px`, top: SUBTITLE_TOP(trackIdx) }}
      title={`${label} — drag to move, drag an edge to retime`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(index);
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        setDragSubtitleState({
          mode: "segment",
          index,
          startX: e.clientX,
          startValue: cue.start,
          endValue: cue.end,
        });
      }}
    >
      <div
        className="flex h-full items-center justify-center overflow-hidden"
        style={{ paddingLeft: SUBTITLE_HANDLE_PX + 2, paddingRight: SUBTITLE_HANDLE_PX + 2 }}
      >
        <Captions size={12} className="mr-1 shrink-0 text-[#2D1F61]" />
        <span className="truncate text-[11px] font-semibold text-[#2D1F61] select-none track-text">
          {label}
        </span>
      </div>

      <div
        className="absolute top-0 left-0 flex h-[32px] items-center justify-center rounded-l-md bg-[#8A76FC]/70 cursor-ew-resize transition-colors hover:bg-[#6E5AD8]"
        style={{ width: `${SUBTITLE_HANDLE_PX}px` }}
        onMouseDown={(e) => {
          e.stopPropagation();
          setDragSubtitleState({
            mode: "edge",
            index,
            side: "left",
            startX: e.clientX,
            startValue: cue.start,
          });
        }}
        aria-label="Resize subtitle start"
        title="Drag to retime the start"
      >
        <div className="h-[16px] w-px bg-white/80" />
      </div>

      <div
        className="absolute top-0 right-0 flex h-[32px] items-center justify-center rounded-r-md bg-[#8A76FC]/70 cursor-ew-resize transition-colors hover:bg-[#6E5AD8]"
        style={{ width: `${SUBTITLE_HANDLE_PX}px` }}
        onMouseDown={(e) => {
          e.stopPropagation();
          setDragSubtitleState({
            mode: "edge",
            index,
            side: "right",
            startX: e.clientX,
            startValue: cue.end,
          });
        }}
        aria-label="Resize subtitle end"
        title="Drag to retime the end"
      >
        <div className="h-[16px] w-px bg-white/80" />
      </div>
    </div>
  );
}

/**
 * A run of cues too narrow to draw individually at this zoom — the level-of-
 * detail half of the density solution (see `layoutSubtitleTrack`).
 *
 * Not draggable, and it does not pretend to be: it is drawn hatched and carries
 * a magnifier, because the only thing it does is zoom the ruler in until the
 * cues underneath it become real blocks.
 */
export function SubtitleClusterBlock({
  item,
  trackIdx,
  onFocus,
}: {
  item: SubtitleClusterItem;
  trackIdx: number;
  onFocus: (cluster: SubtitleClusterItem) => void;
}) {
  return (
    <button
      type="button"
      className="subtitle-cue-cluster absolute h-[32px] rounded-md border border-[#A594F9]/70 bg-[#A594F9]/25 opacity-80 transition-opacity hover:opacity-100 z-8 cursor-zoom-in overflow-hidden"
      style={{
        left: `${item.leftPx}px`,
        width: `${item.widthPx}px`,
        top: SUBTITLE_TOP(trackIdx),
        backgroundImage:
          "repeating-linear-gradient(45deg, rgba(138,118,252,0.35) 0 3px, transparent 3px 7px)",
      }}
      title={`${item.count} subtitles between ${item.startSeconds.toFixed(1)}s and ${item.endSeconds.toFixed(
        1
      )}s — click to zoom in and edit them`}
      onClick={(e) => {
        e.stopPropagation();
        onFocus(item);
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <span className="flex h-full items-center justify-center gap-1 px-1 text-[10px] font-bold text-[#2D1F61] select-none track-text">
        <Search size={10} className="shrink-0" />
        {item.count}
      </span>
    </button>
  );
}

/**
 * Lane block for an uploaded audio clip. Draggable/resizable like the other
 * block types: body drag moves it along the video timeline, edge handles
 * resize its window (the preview loops the trimmed source to fill it).
 */
export function AudioClipBlock({
  clip,
  idx,
  minValue,
  maxValue,
  zoomedTimelineWidth,
  trackIdx,
  placements,
  selected,
  onSelect,
  setDragAudioState,
}: {
  clip: AudioClipDto;
  idx: number;
  minValue: number;
  maxValue: number;
  zoomedTimelineWidth: number;
  trackIdx: number;
  placements: Record<string, ClipPlacement>;
  selected: boolean;
  onSelect: (clipId: string) => void;
  setDragAudioState: React.Dispatch<React.SetStateAction<DragAudioState | null>>;
}) {
  const window = getClipTimelineWindow(clip, placements);
  const start = Math.min(window.start, maxValue);
  const end = Math.min(window.start + window.len, maxValue);
  const startPosition = ((start - minValue) / (maxValue - minValue)) * zoomedTimelineWidth;
  const endPosition = ((end - minValue) / (maxValue - minValue)) * zoomedTimelineWidth;
  const width = Math.max(6, endPosition - startPosition);
  const isProcessing =
    clip.status === "PROCESSING" ||
    clip.status === "TRIM_PROCESSING" ||
    clip.status === "UPLOADING";

  return (
    <div
      key={`audio-${clip.id}`}
      className={`absolute h-[32px] group transition-opacity track-audio sequence-block-shape ${
        isProcessing
          ? "bg-[#A594F9]/25 border border-dashed border-[#8A76FC] opacity-60 rounded-md z-8"
          : selected
            ? "bg-[#A594F9]/55 border-2 border-[#8A76FC] opacity-95 rounded-md cursor-grab z-10"
            : "bg-[#A594F9]/40 border border-[#8A76FC] opacity-75 hover:opacity-90 rounded-md cursor-grab z-8"
      }`}
      style={{
        left: `${startPosition}px`,
        width: `${width}px`,
        top: `${TIMELINE_RULER_HEIGHT + trackIdx * 36}px`,
      }}
      title={`${clip.fileName}${isProcessing ? " (processing...)" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        if (!isProcessing) {
          onSelect(clip.id);
        }
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        if (isProcessing) {
          return;
        }
        onSelect(clip.id);
        setDragAudioState({
          mode: "segment",
          id: clip.id,
          startX: e.clientX,
          startValue: start,
        });
      }}
    >
      <div className="w-full h-full flex justify-center items-center">
        <div className="flex items-center gap-1 px-2 py-1 bg-transparent pointer-events-none overflow-hidden max-w-full">
          <Image
            src="/icons/volume.svg"
            alt="Audio"
            width={14}
            height={14}
            className="select-none"
          />
          <div className="text-xs font-bold text-[#6B5BB5] select-none truncate max-w-[200px] track-text">
            {clip.fileName || `Audio ${idx + 1}`}
          </div>
          {isProcessing && (
            <div className="text-[10px] font-semibold uppercase text-[#8A76FC] select-none track-text">
              processing
            </div>
          )}
        </div>
      </div>

      {!isProcessing && (
        <>
          <div
            className="flex items-center justify-center absolute py-1 top-0 -left-1 h-[32px] w-[23px] bg-[#8A76FC]/70 rounded-l-md opacity-0 group-hover:opacity-100 cursor-ew-resize transition-opacity hover:bg-[#8A76FC]"
            onMouseDown={(e) => {
              e.stopPropagation();
              onSelect(clip.id);
              setDragAudioState({
                mode: "edge",
                id: clip.id,
                side: "left",
                startX: e.clientX,
                startValue: start,
              });
            }}
            aria-label="Resize audio start"
            title="Drag to resize start"
          >
            <div className="w-px h-[20px] bg-white/80" />
          </div>

          <div
            className="flex items-center justify-center absolute py-1 top-0 -right-1 h-[32px] w-[23px] bg-[#8A76FC]/70 rounded-r-md opacity-0 group-hover:opacity-100 cursor-ew-resize transition-opacity hover:bg-[#8A76FC]"
            onMouseDown={(e) => {
              e.stopPropagation();
              onSelect(clip.id);
              setDragAudioState({
                mode: "edge",
                id: clip.id,
                side: "right",
                startX: e.clientX,
                startValue: end,
              });
            }}
            aria-label="Resize audio end"
            title="Drag to resize end"
          >
            <div className="w-px h-[20px] bg-white/80" />
          </div>
        </>
      )}
    </div>
  );
}
