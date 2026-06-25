import { X } from "lucide-react";
import axios from "axios";
import { toast } from "react-hot-toast";

import EditorSidebar from "@/app/components/EditorSidebar";
import SidemenuDashboard from "@/app/components/SidemenuDashboard";
import ZoomModal from "@/app/components/ZoomModal";
import type {
  CtaItem,
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

  // CTA CRUD. Definitions live in the Cta table (not demo.editing) and are
  // managed over HTTP. Local state is updated optimistically and rolled back on
  // failure. The API enforces ownership (401 anon / 404 non-owner).
  const { savedDemoId, ctas, setCtas } = editorState;

  const handleAddCta = async (data: { label: string; url: string; placement?: string }) => {
    if (!savedDemoId) {
      toast.error("Save the demo before adding a call to action");
      return;
    }
    const placement = data.placement?.trim() ? data.placement.trim() : null;
    const tempId = `temp-${Date.now()}`;
    const optimistic: CtaItem = {
      id: tempId,
      label: data.label,
      url: data.url,
      placement,
      order: ctas.length,
    };
    setCtas([...ctas, optimistic]);
    try {
      const res = await axios.post(`/api/demos/${savedDemoId}/ctas`, {
        label: data.label,
        url: data.url,
        ...(placement ? { placement } : {}),
      });
      const created = res.data?.cta;
      setCtas((prev) =>
        prev.map((c) =>
          c.id === tempId
            ? {
                id: String(created?.id ?? tempId),
                label: String(created?.label ?? optimistic.label),
                url: String(created?.url ?? optimistic.url),
                placement: created?.placement ?? optimistic.placement,
                order: typeof created?.order === "number" ? created.order : optimistic.order,
              }
            : c
        )
      );
      toast.success("Call to action added");
    } catch {
      setCtas((prev) => prev.filter((c) => c.id !== tempId));
      toast.error("Failed to add call to action");
    }
  };

  const handleUpdateCta = async (
    id: string,
    data: { label?: string; url?: string; placement?: string | null }
  ) => {
    const prevCtas = ctas;
    setCtas((prev) => prev.map((c) => (c.id === id ? { ...c, ...data } : c)));
    try {
      await axios.patch(`/api/ctas/${id}`, data);
      toast.success("Call to action updated");
    } catch {
      setCtas(prevCtas);
      toast.error("Failed to update call to action");
    }
  };

  const handleDeleteCta = async (id: string) => {
    const prevCtas = ctas;
    setCtas((prev) => prev.filter((c) => c.id !== id));
    try {
      await axios.delete(`/api/ctas/${id}`);
      toast.success("Call to action removed");
    } catch {
      setCtas(prevCtas);
      toast.error("Failed to remove call to action");
    }
  };

  const handleReorderCta = async (id: string, direction: "up" | "down") => {
    const index = ctas.findIndex((c) => c.id === id);
    if (index === -1) {
      return;
    }
    const swapWith = direction === "up" ? index - 1 : index + 1;
    if (swapWith < 0 || swapWith >= ctas.length) {
      return;
    }
    const prevCtas = ctas;
    const current = ctas[index];
    const neighbour = ctas[swapWith];
    const reordered = [...ctas];
    reordered[index] = { ...neighbour, order: current.order };
    reordered[swapWith] = { ...current, order: neighbour.order };
    setCtas(reordered);
    try {
      await Promise.all([
        axios.patch(`/api/ctas/${current.id}`, { order: neighbour.order }),
        axios.patch(`/api/ctas/${neighbour.id}`, { order: current.order }),
      ]);
    } catch {
      setCtas(prevCtas);
      toast.error("Failed to reorder call to action");
    }
  };

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
    ctas: editorState.ctas,
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
