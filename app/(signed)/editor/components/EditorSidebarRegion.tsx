import { X } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import EditorSidebar from "@/app/components/EditorSidebar";
import SidemenuDashboard from "@/app/components/SidemenuDashboard";
import ZoomModal from "@/app/components/ZoomModal";
import { useEditorStore } from "@/app/store/editor/editorStore";
import { useCtaActions } from "../hooks/useCtaActions";
import type {
  EditorState,
  ExportFlowApi,
  SubtitlesApi,
  TextOverlaysApi,
  ZoomEditorApi,
} from "../apiTypes";

interface EditorSidebarRegionProps {
  text: TextOverlaysApi;
  zoom: ZoomEditorApi;
  subtitles: SubtitlesApi;
  exportFlow: ExportFlowApi;
  thumbnailUrl: string | null;
  /** The player itself stays a ref (never in the store), so it is passed in. */
  playerRef: EditorState["playerRef"];
}

// Every editor-store value the sidebar region reads, in one shallow subscription.
function useSidebarStoreState() {
  return useEditorStore(
    useShallow((s) => ({
      isSidebarOpen: s.isSidebarOpen,
      setIsSidebarOpen: s.setIsSidebarOpen,
      isDashboardMenuOpen: s.isDashboardMenuOpen,
      setIsDashboardMenuOpen: s.setIsDashboardMenuOpen,
      savedDemoId: s.savedDemoId,
      ctas: s.ctas,
      setCtas: s.setCtas,
      sidebarTitle: s.sidebarTitle,
      selectedBackground: s.selectedBackground,
      setSelectedBackground: s.setSelectedBackground,
      backgroundType: s.backgroundType,
      setBackgroundType: s.setBackgroundType,
      customBackground: s.customBackground,
      setCustomBackground: s.setCustomBackground,
      aspectRatio: s.aspectRatio,
      setAspectRatio: s.setAspectRatio,
      browserFrameMode: s.browserFrameMode,
      setBrowserFrameMode: s.setBrowserFrameMode,
      browserFrameDrawShadow: s.browserFrameDrawShadow,
      setBrowserFrameDrawShadow: s.setBrowserFrameDrawShadow,
      browserFrameDrawBorder: s.browserFrameDrawBorder,
      setBrowserFrameDrawBorder: s.setBrowserFrameDrawBorder,
      savingDemo: s.savingDemo,
      demoSaved: s.demoSaved,
      setShowSaveDemoModal: s.setShowSaveDemoModal,
      setCurrentTime: s.setCurrentTime,
    }))
  );
}

export default function EditorSidebarRegion({
  text,
  zoom,
  subtitles,
  exportFlow,
  thumbnailUrl,
  playerRef,
}: EditorSidebarRegionProps) {
  const {
    isSidebarOpen,
    setIsSidebarOpen,
    isDashboardMenuOpen,
    setIsDashboardMenuOpen,
    savedDemoId,
    ctas,
    setCtas,
    sidebarTitle,
    selectedBackground,
    setSelectedBackground,
    backgroundType,
    setBackgroundType,
    customBackground,
    setCustomBackground,
    aspectRatio,
    setAspectRatio,
    browserFrameMode,
    setBrowserFrameMode,
    browserFrameDrawShadow,
    setBrowserFrameDrawShadow,
    browserFrameDrawBorder,
    setBrowserFrameDrawBorder,
    savingDemo,
    demoSaved,
    setShowSaveDemoModal,
    setCurrentTime,
  } = useSidebarStoreState();

  const toggleDashboardMenu = () => setIsDashboardMenuOpen(!isDashboardMenuOpen);
  const closeDashboardMenu = () => setIsDashboardMenuOpen(false);

  const { handleAddCta, handleUpdateCta, handleDeleteCta, handleReorderCta } = useCtaActions({
    savedDemoId,
    ctas,
    setCtas,
  });

  // Move the player from the sidebar — the subtitle panel jumps to a cue with
  // it. Both halves are needed, as in the preview's own controls: the store
  // drives the playhead UI, the ref drives the video.
  const handleSeek = (seconds: number) => {
    setCurrentTime(seconds);
    playerRef.current?.seekTo(seconds, "seconds");
  };

  const sidebarProps = {
    title: sidebarTitle,
    onExportWebM: () => exportFlow.setShowExportSettings(true),
    thumbnailUrl: thumbnailUrl || undefined,
    selectedBackground: selectedBackground,
    setSelectedBackground: setSelectedBackground,
    backgroundType: backgroundType,
    setBackgroundType: setBackgroundType,
    customBackground: customBackground,
    setCustomBackground: setCustomBackground,
    aspectRatio: aspectRatio,
    setAspectRatio: setAspectRatio,
    browserFrameMode: browserFrameMode,
    setBrowserFrameMode: setBrowserFrameMode,
    browserFrameDrawShadow: browserFrameDrawShadow,
    setBrowserFrameDrawShadow: setBrowserFrameDrawShadow,
    browserFrameDrawBorder: browserFrameDrawBorder,
    setBrowserFrameDrawBorder: setBrowserFrameDrawBorder,
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
    onCancelSubtitles: subtitles.handleCancelSubtitles,
    cancelling: subtitles.cancelling,
    onSeek: handleSeek,
    onOpenSaveDemo: () => setShowSaveDemoModal(true),
    savingDemo: savingDemo,
    demoSaved: demoSaved,
    onToggleDashboardMenu: toggleDashboardMenu,
    ctas: ctas,
    onAddCta: handleAddCta,
    onUpdateCta: handleUpdateCta,
    onDeleteCta: handleDeleteCta,
    onReorderCta: handleReorderCta,
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

      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black bg-opacity-40"
            onClick={() => setIsSidebarOpen(false)}
          />
          <div className="relative w-full max-w-xs h-full bg-white shadow-lg z-50 animate-slide-in-left">
            <button
              className="absolute top-4 right-4 text-[#7C5CFC]"
              onClick={() => setIsSidebarOpen(false)}
              aria-label="Close sidebar"
            >
              <X size={28} />
            </button>
            <EditorSidebar {...sidebarProps} forceShowMobile={true} className="w-full h-full" />
          </div>
        </div>
      )}

      {isDashboardMenuOpen && (
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
