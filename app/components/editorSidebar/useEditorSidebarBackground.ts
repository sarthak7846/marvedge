import React from "react";
import { BgSubTab, imageBackgroundOptions } from "./backgroundOptions";

interface UseEditorSidebarBackgroundProps {
  selectedBackground?: string | null;
  setSelectedBackground?: (bg: string | null) => void;
  backgroundType?: string;
  customBackground?: File | null;
  setCustomBackground?: (file: File | null) => void;
}

export function useEditorSidebarBackground({
  selectedBackground,
  setSelectedBackground,
  backgroundType,
  customBackground,
  setCustomBackground,
}: UseEditorSidebarBackgroundProps) {
  const [bgSubTab, setBgSubTab] = React.useState<BgSubTab>("image");

  const [localSelectedBackground, setLocalSelectedBackground] = React.useState<string | null>(
    selectedBackground ?? null
  );
  const [localBackgroundType, setLocalBackgroundType] = React.useState<string>(
    backgroundType || ""
  );
  const [localCustomBackground, setLocalCustomBackground] = React.useState<File | null>(
    customBackground || null
  );
  const [customBackgroundUrl, setCustomBackgroundUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (selectedBackground !== undefined) {
      setLocalSelectedBackground(selectedBackground);
    }
  }, [selectedBackground]);
  React.useEffect(() => {
    if (backgroundType !== undefined) {
      setLocalBackgroundType(backgroundType);
    }
  }, [backgroundType]);
  React.useEffect(() => {
    if (customBackground !== undefined) {
      setLocalCustomBackground(customBackground);
    }
  }, [customBackground]);

  const handleBackgroundSelect = (value: string | null) => {
    const nextValue = localSelectedBackground === value ? null : value;
    setLocalSelectedBackground(nextValue);
    setSelectedBackground?.(nextValue);
  };

  const handleCustomBackgroundUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setLocalCustomBackground(file);
      setCustomBackground?.(file);
      handleBackgroundSelect("custom");
      setCustomBackgroundUrl(URL.createObjectURL(file));
      setBgSubTab("image");
    }
  };

  const filteredImageBackgroundOptions = imageBackgroundOptions.filter((bg) => {
    if (!localBackgroundType) {
      return bg.type === "default";
    }
    return bg.type === (localBackgroundType as "solid" | "gradient");
  });

  return {
    bgSubTab,
    localSelectedBackground,
    localBackgroundType,
    setLocalBackgroundType,
    localCustomBackground,
    customBackgroundUrl,
    handleBackgroundSelect,
    handleCustomBackgroundUpload,
    filteredImageBackgroundOptions,
  };
}
