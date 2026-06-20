import { X } from "lucide-react";

import EditorSidebar from "@/app/components/EditorSidebar";
import SidemenuDashboard from "@/app/components/SidemenuDashboard";
import ZoomModal from "@/app/components/ZoomModal";
import type {
  EditorState,
  ExportFlowApi,
  SubtitlesApi,
  TextOverlaysApi,
  ZoomEditorApi,
} from "../apiTypes";

interface EditorSidebarRegionProps {
  editorState: EditorState;
  text: TextOverlaysApi;
  zoom: ZoomEditorApi;
  subtitles: SubtitlesApi;
  exportFlow: ExportFlowApi;
  thumbnailUrl: string | null;
}

export default function EditorSidebarRegion({
  editorState,
  text,
  zoom,
  subtitles,
  exportFlow,
  thumbnailUrl,
}: EditorSidebarRegionProps) {
  const toggleDashboardMenu = () =>
    editorState.setIsDashboardMenuOpen(!editorState.isDashboardMenuOpen);
  const closeDashboardMenu = () => editorState.setIsDashboardMenuOpen(false);

  const sidebarProps = {
    title: editorState.sidebarTitle,
    onExportWebM: () => exportFlow.setShowExportSettings(true),
    thumbnailUrl: thumbnailUrl || undefined,
    selectedBackground: editorState.selectedBackground,
    setSelectedBackground: editorState.setSelectedBackground,
    backgroundType: editorState.backgroundType,
    setBackgroundType: editorState.setBackgroundType,
    customBackground: editorState.customBackground,
    setCustomBackground: editorState.setCustomBackground,
    aspectRatio: editorState.aspectRatio,
    setAspectRatio: editorState.setAspectRatio,
    browserFrameMode: editorState.browserFrameMode,
    setBrowserFrameMode: editorState.setBrowserFrameMode,
    browserFrameDrawShadow: editorState.browserFrameDrawShadow,
    setBrowserFrameDrawShadow: editorState.setBrowserFrameDrawShadow,
    browserFrameDrawBorder: editorState.browserFrameDrawBorder,
    setBrowserFrameDrawBorder: editorState.setBrowserFrameDrawBorder,
    textOverlayInput: text.textOverlayInput,
    setTextOverlayInput: text.handleTextOverlayInputChange,
    textOverlayFontFamily: text.textOverlayFontFamily,
    setTextOverlayFontFamily: text.handleTextOverlayFontFamilyChange,
    textOverlayFontSize: text.textOverlayFontSize,
    setTextOverlayFontSize: text.handleTextOverlayFontSizeChange,
    textOverlayColor: text.textOverlayColor,
    setTextOverlayColor: text.handleTextOverlayColorChange,
    onAddTextOverlay: text.handleAddTextOverlay,
    onAddSubtitles: subtitles.handleAddSubtitles,
    onClearSubtitles: subtitles.handleSkipSubtitles,
    subtitlesLoading: subtitles.subtitlesLoading,
    hasSubtitles: subtitles.subtitleCues.length > 0,
    onOpenSaveDemo: () => editorState.setShowSaveDemoModal(true),
    savingDemo: editorState.savingDemo,
    demoSaved: editorState.demoSaved,
    onToggleDashboardMenu: toggleDashboardMenu,
  };

  return (
    <>
      <div className="editor-sidebar-container hidden md:block w-80 bg-white shadow-lg z-40">
        <div className="w-full h-full relative">
          <EditorSidebar {...sidebarProps} />
          {zoom.activeZoomIdx != -1 && zoom.showZoomModal ? (
            <ZoomModal
              onClose={() => zoom.setShowZoomModal(false)}
              activeZoomIdx={zoom.activeZoomIdx}
              setZoomSegments={zoom.setZoomSegments}
              zoomSegments={zoom.zoomSegments}
            />
          ) : (
            <div></div>
          )}
        </div>
      </div>

      {editorState.isSidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black bg-opacity-40"
            onClick={() => editorState.setIsSidebarOpen(false)}
          />
          <div className="relative w-full max-w-xs h-full bg-white shadow-lg z-50 animate-slide-in-left">
            <button
              className="absolute top-4 right-4 text-[#7C5CFC]"
              onClick={() => editorState.setIsSidebarOpen(false)}
              aria-label="Close sidebar"
            >
              <X size={28} />
            </button>
            <EditorSidebar {...sidebarProps} forceShowMobile={true} className="w-full h-full" />
          </div>
        </div>
      )}

      {editorState.isDashboardMenuOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/10"
            onClick={closeDashboardMenu}
            aria-label="Close dashboard menu"
          />
          <SidemenuDashboard />
        </div>
      )}
    </>
  );
}
