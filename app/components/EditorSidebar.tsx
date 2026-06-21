import React from "react";
import { MainTab } from "./editorSidebar/backgroundOptions";
import SidebarHeader from "./editorSidebar/SidebarHeader";
import BackgroundPanel from "./editorSidebar/BackgroundPanel";
import ToolsPanel from "./editorSidebar/ToolsPanel";

interface EditorSidebarProps {
  title: string;
  onExportWebM: () => void;
  forceShowMobile?: boolean;
  thumbnailUrl?: string;
  selectedBackground?: string | null;
  setSelectedBackground?: (bg: string | null) => void;
  backgroundType?: string;
  setBackgroundType?: (type: string) => void;
  customBackground?: File | null;
  setCustomBackground?: (file: File | null) => void;
  aspectRatio?: string;
  setAspectRatio?: (ratio: string) => void;
  browserFrameMode?: "default" | "minimal" | "hidden";
  setBrowserFrameMode?: (mode: "default" | "minimal" | "hidden") => void;
  browserFrameDrawShadow?: boolean;
  setBrowserFrameDrawShadow?: (enabled: boolean) => void;
  browserFrameDrawBorder?: boolean;
  setBrowserFrameDrawBorder?: (enabled: boolean) => void;
  textOverlayInput?: string;
  setTextOverlayInput?: (value: string) => void;
  textOverlayFontFamily?: string;
  setTextOverlayFontFamily?: (value: string) => void;
  textOverlayFontSize?: number;
  setTextOverlayFontSize?: (value: number) => void;
  onAddTextOverlay?: () => void;
  onDeleteSelectedTextOverlay?: () => void;
  hasSelectedTextOverlay?: boolean;
  textOverlayColor?: string;
  setTextOverlayColor?: (value: string) => void;
  onAddSubtitles?: () => void;
  onClearSubtitles?: () => void;
  subtitlesLoading?: boolean;
  hasSubtitles?: boolean;
  className?: string;
  onOpenSaveDemo?: () => void;
  savingDemo?: boolean;
  demoSaved?: boolean;
  onToggleDashboardMenu?: () => void;
}

const EditorSidebar: React.FC<EditorSidebarProps> = ({
  title,
  onExportWebM,
  forceShowMobile = false,

  selectedBackground,
  setSelectedBackground,
  backgroundType,
  setBackgroundType,
  customBackground,
  setCustomBackground,
  aspectRatio = "native",
  setAspectRatio,
  browserFrameDrawShadow = true,
  setBrowserFrameDrawShadow,
  browserFrameDrawBorder = false,
  setBrowserFrameDrawBorder,
  textOverlayInput = "Add text",
  setTextOverlayInput,
  textOverlayFontFamily = "Arial",
  setTextOverlayFontFamily,
  textOverlayFontSize = 24,
  setTextOverlayFontSize,
  onAddTextOverlay,
  textOverlayColor = "#ffffff",
  setTextOverlayColor,
  onAddSubtitles,
  onClearSubtitles,
  subtitlesLoading = false,
  hasSubtitles = false,
  onOpenSaveDemo,
  savingDemo = false,
  demoSaved = false,
  onToggleDashboardMenu,
}) => {
  const [activeTab, setActiveTab] = React.useState<MainTab>("background");

  return (
    <aside
      className={`editor-sidebar w-full max-w-xs h-screen bg-white border-r border-[#ede7fa] px-4 py-4 flex flex-col gap-4 overflow-y-auto ${
        forceShowMobile ? "flex" : "hidden md:flex"
      }`}
    >
      <SidebarHeader
        title={title}
        onToggleDashboardMenu={onToggleDashboardMenu}
        onOpenSaveDemo={onOpenSaveDemo}
        savingDemo={savingDemo}
        demoSaved={demoSaved}
        onExportWebM={onExportWebM}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {activeTab === "background" && (
        <BackgroundPanel
          selectedBackground={selectedBackground}
          setSelectedBackground={setSelectedBackground}
          backgroundType={backgroundType}
          setBackgroundType={setBackgroundType}
          customBackground={customBackground}
          setCustomBackground={setCustomBackground}
        />
      )}

      {activeTab === "tools" && (
        <ToolsPanel
          aspectRatio={aspectRatio}
          setAspectRatio={setAspectRatio}
          browserFrameDrawShadow={browserFrameDrawShadow}
          setBrowserFrameDrawShadow={setBrowserFrameDrawShadow}
          browserFrameDrawBorder={browserFrameDrawBorder}
          setBrowserFrameDrawBorder={setBrowserFrameDrawBorder}
          textOverlayInput={textOverlayInput}
          setTextOverlayInput={setTextOverlayInput}
          textOverlayFontFamily={textOverlayFontFamily}
          setTextOverlayFontFamily={setTextOverlayFontFamily}
          textOverlayFontSize={textOverlayFontSize}
          setTextOverlayFontSize={setTextOverlayFontSize}
          onAddTextOverlay={onAddTextOverlay}
          textOverlayColor={textOverlayColor}
          setTextOverlayColor={setTextOverlayColor}
          onAddSubtitles={onAddSubtitles}
          onClearSubtitles={onClearSubtitles}
          subtitlesLoading={subtitlesLoading}
          hasSubtitles={hasSubtitles}
        />
      )}
    </aside>
  );
};

export default EditorSidebar;
