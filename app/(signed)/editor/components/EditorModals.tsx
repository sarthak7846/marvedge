import axios from "axios";
import { Toaster } from "react-hot-toast";
import { useShallow } from "zustand/react/shallow";

import ExportResultModal from "@/app/components/ExportResultModal";
import ExportSettingsModal from "@/app/components/ExportSettingsModal";
import SaveDemoModal from "@/app/components/SaveDemoModal";
import ZoomEffectsPopup from "@/app/components/ZoomEffectsPopup";
import { useEditorStore } from "@/app/store/editor/editorStore";
import type { EditorState, ExportFlowApi } from "../apiTypes";

interface EditorModalsProps {
  exportFlow: ExportFlowApi;
  onSaveDemo: (data: { title: string; description: string }) => Promise<void>;
  resolvedDuration: number;
  playerRef: EditorState["playerRef"];
}

export default function EditorModals({
  exportFlow,
  onSaveDemo,
  resolvedDuration,
  playerRef,
}: EditorModalsProps) {
  const {
    isZoomPopupOpen,
    setIsZoomPopupOpen,
    zoomEffects,
    setZoomEffects,
    currentTime,
    showSaveDemoModal,
    setShowSaveDemoModal,
    sidebarTitle,
    sidebarDescription,
    savingDemo,
    demoSaved,
  } = useEditorStore(
    useShallow((s) => ({
      isZoomPopupOpen: s.isZoomPopupOpen,
      setIsZoomPopupOpen: s.setIsZoomPopupOpen,
      zoomEffects: s.zoomEffects,
      setZoomEffects: s.setZoomEffects,
      currentTime: s.currentTime,
      showSaveDemoModal: s.showSaveDemoModal,
      setShowSaveDemoModal: s.setShowSaveDemoModal,
      sidebarTitle: s.sidebarTitle,
      sidebarDescription: s.sidebarDescription,
      savingDemo: s.savingDemo,
      demoSaved: s.demoSaved,
    }))
  );

  const { pendingExport, shareLinkSaved, setShowExportResultModal, setPendingExport } = exportFlow;

  return (
    <>
      <ExportSettingsModal
        isOpen={exportFlow.showExportSettings}
        onClose={() => exportFlow.setShowExportSettings(false)}
        onConfirm={exportFlow.onExportVideo}
        durationInSeconds={resolvedDuration || 0}
      />
      <ExportResultModal
        isOpen={exportFlow.showExportResultModal}
        shareUrl={pendingExport?.shareUrl || null}
        title={sidebarTitle}
        loading={exportFlow.resultActionLoading}
        onClose={() => {
          if (exportFlow.resultActionLoading) {
            return;
          }

          if (pendingExport && !shareLinkSaved) {
            axios
              .post("/api/exported-videos/cleanup", {
                exportedUrl: pendingExport.exportedUrl,
                sourceVideoUrl: pendingExport.uploadedSourceVideo
                  ? pendingExport.sourceVideoUrl
                  : null,
                demoId: pendingExport.demoId,
              })
              .catch((e) => console.error("Cleanup on close failed:", e));
          }
          setShowExportResultModal(false);
          setPendingExport(null);
        }}
        onDownloadMp4={exportFlow.handleDownloadMp4Only}
        onSaveShareLink={exportFlow.handleSaveShareLink}
      />
      <Toaster
        position="top-center"
        toastOptions={{
          className: "toast-popup-card",
          style: {
            background: "#2D2A3A",
            color: "#fff",
            fontWeight: "bold",
            fontSize: "1.1rem",
            boxShadow: "0 4px 24px 0 #0008",
            borderRadius: "10px",
            zIndex: 99999,
          },
          success: { iconTheme: { primary: "#7C5CFC", secondary: "#fff" } },
          error: { iconTheme: { primary: "#f87171", secondary: "#fff" } },
        }}
      />

      <ZoomEffectsPopup
        isOpen={isZoomPopupOpen}
        onClose={() => setIsZoomPopupOpen(false)}
        zoomEffects={zoomEffects}
        onZoomEffectsChange={setZoomEffects}
        currentTime={currentTime}
        duration={resolvedDuration}
        onSeek={(time) => {
          if (playerRef.current) {
            const player = playerRef.current.getInternalPlayer();
            if (player) {
              player.currentTime = time;
              player.dispatchEvent(new Event("seeking"));
              playerRef.current.seekTo(time, "seconds");
            }
          }
        }}
      />

      <SaveDemoModal
        isOpen={showSaveDemoModal}
        onClose={() => setShowSaveDemoModal(false)}
        onSave={onSaveDemo}
        initialTitle={sidebarTitle}
        initialDescription={sidebarDescription}
        processing={savingDemo}
        isSaved={demoSaved}
      />
    </>
  );
}
