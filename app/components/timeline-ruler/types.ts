import React from "react";
import ReactPlayer from "react-player";
import { ZoomEffect } from "../../types/editor/zoom-effect";

export type TextOverlayItem = {
  id: string;
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  startTime: number;
  endTime: number;
  fontFamily: string;
  fontSize: number;
  color: string;
};

export type EditorAction =
  | { type: "add-trim"; segment: { start: number; end: number } }
  | {
      type: "remove-trim";
      segment: { start: number; end: number };
      index: number;
    }
  | { type: "add-zoom"; segment: ZoomEffect }
  | { type: "remove-zoom"; segment: ZoomEffect; index: number };

export type DragState =
  | {
      mode: "edge";
      index: number;
      side: "left" | "right";
      startX: number;
      startValue: number;
    }
  | {
      mode: "segment";
      index: number;
      startX: number;
      startValue: number;
      endValue: number;
    };

export type DragZoomState =
  | {
      mode: "edge";
      index: number;
      side: "left" | "right";
      startX: number;
      startValue: number;
    }
  | {
      mode: "segment";
      index: number;
      startX: number;
      startValue: number;
      endValue: number;
    };

export type DragTextState =
  | {
      mode: "edge";
      id: string;
      side: "left" | "right";
      startX: number;
      startValue: number;
    }
  | {
      mode: "segment";
      id: string;
      startX: number;
      startValue: number;
      endValue: number;
    };

export interface TimelineRulerProps {
  minValue?: number;
  maxValue?: number;
  currentValue?: number;
  onValueChange?: (value: number) => void;
  step?: number;
  majorStep?: number;
  minorStep?: number;
  microStep?: number;
  startTime?: number;
  endTime?: number;
  onStartTimeChange?: (value: number) => void;
  onEndTimeChange?: (value: number) => void;
  processing?: boolean;
  onResetVideo?: () => void;

  onTrim?: (segments: { start: string; end: string }[]) => Promise<void>;
  setPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  playing: boolean;
  playbackSpeed: number;
  setPlaybackSpeed: (v: number) => void;

  mode: "main" | "trim" | "zoom" | "text";
  setMode: React.Dispatch<React.SetStateAction<"main" | "trim" | "zoom" | "text">>;
  playerRef: React.RefObject<ReactPlayer>;
  setChildHandleProgress: (fn: (data: { playedSeconds: number }) => void) => void;
  zoomSegments: ZoomEffect[];
  setZoomSegments: React.Dispatch<React.SetStateAction<ZoomEffect[]>>;
  activeZoomIdx: number;
  setActiveZoomIdx: React.Dispatch<React.SetStateAction<number>>;
  zoomLevelDepth: number;
  segments: { start: number; end: number }[];
  setSegments: React.Dispatch<React.SetStateAction<{ start: number; end: number }[]>>;
  textOverlays: TextOverlayItem[];
  setTextOverlays: React.Dispatch<React.SetStateAction<TextOverlayItem[]>>;
  selectedTextOverlayId: string | null;
  setSelectedTextOverlayId: React.Dispatch<React.SetStateAction<string | null>>;
  setTextOverlayInspectorValues: (overlay: TextOverlayItem) => void;
  isDraggingTimelineRef: React.MutableRefObject<boolean>;
}
