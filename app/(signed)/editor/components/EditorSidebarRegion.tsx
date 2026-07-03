import { X } from "lucide-react";
import axios from "axios";
import { toast } from "react-hot-toast";
import { useShallow } from "zustand/react/shallow";

import EditorSidebar from "@/app/components/EditorSidebar";
import SidemenuDashboard from "@/app/components/SidemenuDashboard";
import ZoomModal from "@/app/components/ZoomModal";
import { useEditorStore } from "@/app/store/editor/editorStore";
import type {
  CtaItem,
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
}

export default function EditorSidebarRegion({
  text,
  zoom,
  subtitles,
  exportFlow,
  thumbnailUrl,
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
  } = useEditorStore(
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
    }))
  );

  const toggleDashboardMenu = () => setIsDashboardMenuOpen(!isDashboardMenuOpen);
  const closeDashboardMenu = () => setIsDashboardMenuOpen(false);

  // CTA CRUD. Definitions live in the Cta table (not demo.editing) and are
  // managed over HTTP. Local state is updated optimistically and rolled back on
  // failure. The API enforces ownership (401 anon / 404 non-owner).
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
