import React from "react";
import ReactPlayer from "react-player";
import { ZoomEffect } from "../../types/editor/zoom-effect";

export interface TrimSegment {
  start: number;
  end: number;
}

export interface TimelineSliderProps {
  duration: number; // Duration in seconds
  formatTime?: (seconds: number) => string; // Custom time formatter
  onTimeChange?: (time: number) => void; // Callback when time changes
  ontrim: (segments: { start: string; end: string }[]) => void;
  processing: boolean;
  playerRef: React.RefObject<ReactPlayer | null>;
  currentTime: number;
  setCurrentTime: (t: number) => void;
  onResetVideo?: () => void;
  setProgress?: (progress: number) => void; // new prop
  zoomEffects?: ZoomEffect[];
  onZoomEffectCreate?: (effect: ZoomEffect) => void;
  onZoomEffectRemove?: (id: string) => void;
  externalStartTime?: number;
  externalEndTime?: number;
  onExternalTimeChange?: (start: number, end: number) => void;
  // New prop for initial segments
  initialSegments?: { start: string; end: string }[];
  // New prop for segment change callback
  onSegmentsChange?: (segments: { start: string; end: string }[]) => void;
}
