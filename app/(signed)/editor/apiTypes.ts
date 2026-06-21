import type { useEditorState } from "./hooks/useEditorState";
import type { useTextOverlays } from "./hooks/useTextOverlays";
import type { useZoomEditor } from "./hooks/useZoomEditor";
import type { useSubtitles } from "./hooks/useSubtitles";
import type { useExportFlow } from "./hooks/useExportFlow";

export type EditorState = ReturnType<typeof useEditorState>;
export type TextOverlaysApi = ReturnType<typeof useTextOverlays>;
export type ZoomEditorApi = ReturnType<typeof useZoomEditor>;
export type SubtitlesApi = ReturnType<typeof useSubtitles>;
export type ExportFlowApi = ReturnType<typeof useExportFlow>;
