import React, { useCallback, useState } from "react";

import { TextOverlayItem } from "../types";

interface UseTextOverlayInspectorProps {
  selectedTextOverlayId: string | null;
  setTextOverlays: React.Dispatch<React.SetStateAction<TextOverlayItem[]>>;
  zoomFocusStageRef: React.RefObject<HTMLDivElement | null>;
}

export function useTextOverlayInspector({
  selectedTextOverlayId,
  setTextOverlays,
  zoomFocusStageRef,
}: UseTextOverlayInspectorProps) {
  const [textOverlayInput, setTextOverlayInput] = useState("Add text");
  const [textOverlayFontFamily, setTextOverlayFontFamily] = useState("Arial");
  const [textOverlayFontSize, setTextOverlayFontSize] = useState(24);
  const [textOverlayColor, setTextOverlayColor] = useState("#ffffff");

  const patchSelectedOverlay = useCallback(
    (patch: Partial<TextOverlayItem>) => {
      if (!selectedTextOverlayId) {
        return;
      }
      const stage = zoomFocusStageRef.current;
      const stageW = stage ? stage.getBoundingClientRect().width : 800;
      const stageH = stage ? stage.getBoundingClientRect().height : 450;
      setTextOverlays((prev) =>
        prev.map((item) =>
          item.id === selectedTextOverlayId
            ? { ...item, ...patch, parentW: stageW, parentH: stageH }
            : item
        )
      );
    },
    [selectedTextOverlayId, setTextOverlays, zoomFocusStageRef]
  );

  const handleTextOverlayInputChange = useCallback(
    (value: string) => {
      setTextOverlayInput(value);
      patchSelectedOverlay({ text: value });
    },
    [patchSelectedOverlay]
  );

  const handleTextOverlayFontFamilyChange = useCallback(
    (value: string) => {
      setTextOverlayFontFamily(value);
      patchSelectedOverlay({ fontFamily: value });
    },
    [patchSelectedOverlay]
  );

  const handleTextOverlayFontSizeChange = useCallback(
    (value: number) => {
      setTextOverlayFontSize(value);
      patchSelectedOverlay({ fontSize: value });
    },
    [patchSelectedOverlay]
  );

  const handleTextOverlayColorChange = useCallback(
    (value: string) => {
      setTextOverlayColor(value);
      patchSelectedOverlay({ color: value });
    },
    [patchSelectedOverlay]
  );

  return {
    textOverlayInput,
    textOverlayFontFamily,
    textOverlayFontSize,
    textOverlayColor,
    setTextOverlayInput,
    setTextOverlayFontFamily,
    setTextOverlayFontSize,
    setTextOverlayColor,
    handleTextOverlayInputChange,
    handleTextOverlayFontFamilyChange,
    handleTextOverlayFontSizeChange,
    handleTextOverlayColorChange,
  };
}
