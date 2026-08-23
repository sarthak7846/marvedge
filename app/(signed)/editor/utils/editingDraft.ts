import { ZoomEffect } from "@/app/types/editor/zoom-effect";
import { AvsState } from "@/app/types/avs";
import { WtmState } from "@/app/types/wtm";
import type { SubtitleStyle } from "@/app/lib/subtitles";

import { BrowserFrameMode } from "../hooks/useEditorState";
import { SubtitleCue, TextOverlayItem } from "../types";

// The serialized editing state persisted for a demo (backend `demo.editing`,
// local draft, or URL params). Segments are strings on the wire but may arrive
// as numbers from some sources, so both are accepted when reading back.
export type DemoEditing = {
  segments?: { start: string | number; end: string | number }[];
  zoom?: ZoomEffect[];
  background?: string | null;
  backgroundType?: string;
  subtitles?: SubtitleCue[];
  // SUB styling (font / size / colour / alignment / animation). Absent on demos
  // saved before the style panel existed, and on any demo whose subtitles were
  // never restyled — the worker then falls back to its own hardcoded style, so
  // the export is byte-identical to what it was. No migration; this rides the
  // existing `editing` JSON exactly like `wtm` and `avs` do.
  subtitleStyle?: SubtitleStyle | null;
  textOverlays?: TextOverlayItem[];
  aspectRatio?: string;
  browserFrame?: {
    mode?: BrowserFrameMode;
    drawShadow?: boolean;
    drawBorder?: boolean;
  };
  // AVS state (steps / script / voiceover / pronunciation). Absent on demos
  // saved before AVS existed, or whenever the feature produced no state.
  avs?: AvsState | null;
  // WTM state (watermark / webcam branding). Absent on demos saved before WTM
  // existed, or whenever the branding panel produced no state.
  wtm?: WtmState | null;
};

export interface EditingPayloadInput {
  segments: { start: number; end: number }[];
  zoomSegments: ZoomEffect[];
  selectedBackground: string | null;
  backgroundType: string;
  subtitleCues: SubtitleCue[];
  subtitleStyle: SubtitleStyle | null;
  textOverlays: TextOverlayItem[];
  aspectRatio: string;
  browserFrameMode: BrowserFrameMode;
  browserFrameDrawShadow: boolean;
  browserFrameDrawBorder: boolean;
  avs: AvsState | null;
  wtm: WtmState | null;
}

// Builds the canonical editing payload shared by backend autosave and the local
// draft, so both write the exact same shape.
export function buildEditingPayload(input: EditingPayloadInput): DemoEditing {
  return {
    segments: input.segments.map((s) => ({
      start: String(s.start),
      end: String(s.end),
    })),
    zoom: input.zoomSegments,
    background: input.selectedBackground ?? null,
    backgroundType: input.backgroundType || "",
    subtitles: input.subtitleCues || [],
    subtitleStyle: input.subtitleStyle ?? null,
    textOverlays: input.textOverlays || [],
    aspectRatio: input.aspectRatio || "native",
    browserFrame: {
      mode: input.browserFrameMode,
      drawShadow: input.browserFrameDrawShadow,
      drawBorder: input.browserFrameDrawBorder,
    },
    avs: input.avs ?? null,
    wtm: input.wtm ?? null,
  };
}

export interface EditingSetters {
  setSegments: (segments: { start: number; end: number }[]) => void;
  setCurrentSegments: (segments: { start: string; end: string }[]) => void;
  setZoomSegments: (segments: ZoomEffect[]) => void;
  setSubtitleCues: (cues: SubtitleCue[]) => void;
  setSubtitleStyle: (style: Partial<SubtitleStyle> | null) => void;
  setTextOverlays: (overlays: TextOverlayItem[]) => void;
  setSelectedBackground: (bg: string) => void;
  setBackgroundType: (type: string) => void;
  setAspectRatio: (ratio: string) => void;
  setBrowserFrameMode: (mode: BrowserFrameMode) => void;
  setBrowserFrameDrawShadow: (enabled: boolean) => void;
  setBrowserFrameDrawBorder: (enabled: boolean) => void;
  setAvs: (avs: AvsState | null) => void;
  setWtm: (wtm: WtmState | null) => void;
}

// Applies a saved editing payload back into editor state. Shared by the backend
// demo loader and the local draft restore so both behave identically.
export function applyDemoEditing(ed: DemoEditing, setters: EditingSetters): void {
  if (ed.segments) {
    const numeric = ed.segments
      .map((s) => ({
        start: typeof s.start === "string" ? parseFloat(s.start) : Number(s.start),
        end: typeof s.end === "string" ? parseFloat(s.end) : Number(s.end),
      }))
      .filter((s) => !isNaN(s.start) && !isNaN(s.end));
    if (numeric.length > 0) {
      setters.setSegments(numeric);
      setters.setCurrentSegments(
        ed.segments.map((s) => ({
          start: String(s.start),
          end: String(s.end),
        }))
      );
    }
  }
  if (ed.zoom) {
    setters.setZoomSegments(ed.zoom);
  }
  if (ed.background) {
    setters.setSelectedBackground(ed.background);
  }
  if (ed.backgroundType) {
    setters.setBackgroundType(ed.backgroundType);
  }
  if (ed.subtitles) {
    setters.setSubtitleCues(ed.subtitles);
  }
  // Only restore a style that was actually saved. A demo with none must stay in
  // the "no style config" state rather than being seeded with the defaults,
  // because that is the state the worker's byte-identical fallback keys off.
  if (ed.subtitleStyle) {
    setters.setSubtitleStyle(ed.subtitleStyle);
  }
  if (ed.textOverlays) {
    setters.setTextOverlays(ed.textOverlays);
  }
  if (ed.aspectRatio) {
    setters.setAspectRatio(ed.aspectRatio);
  }
  if (ed.browserFrame) {
    if (ed.browserFrame.mode) {
      setters.setBrowserFrameMode(ed.browserFrame.mode);
    }
    if (typeof ed.browserFrame.drawShadow === "boolean") {
      setters.setBrowserFrameDrawShadow(ed.browserFrame.drawShadow);
    }
    if (typeof ed.browserFrame.drawBorder === "boolean") {
      setters.setBrowserFrameDrawBorder(ed.browserFrame.drawBorder);
    }
  }
  if (ed.avs) {
    setters.setAvs(ed.avs);
  }
  if (ed.wtm) {
    setters.setWtm(ed.wtm);
  }
}
