import { useState } from "react";
import { formatTime } from "@/app/lib/dateTimeUtils";
import { ZoomEffect } from "../types/editor/zoom-effect";

interface UseZoomEffectFormProps {
  zoomEffects: ZoomEffect[];
  onZoomEffectsChange: (effects: ZoomEffect[]) => void;
  currentTime: number;
  duration: number;
}

const parseTime = (timeString: string) => {
  const parts = timeString.split(":").map(Number);
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
};

export function useZoomEffectForm({
  zoomEffects,
  onZoomEffectsChange,
  currentTime,
  duration,
}: UseZoomEffectFormProps) {
  const [editingEffect, setEditingEffect] = useState<ZoomEffect | null>(null);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [zoomLevel, setZoomLevel] = useState(2.0);
  const [centerX, setCenterX] = useState(0.5);
  const [centerY, setCenterY] = useState(0.5);

  const resetForm = () => {
    setStartTime("");
    setEndTime("");
    setZoomLevel(2.0);
    setCenterX(0.5);
    setCenterY(0.5);
    setEditingEffect(null);
  };

  const handleAddEffect = () => {
    const newEffect: ZoomEffect = {
      id: Date.now().toString(),
      startTime: parseTime(startTime),
      endTime: parseTime(endTime),
      zoomLevel,
      x: centerX,
      y: centerY,
    };

    onZoomEffectsChange([...zoomEffects, newEffect]);
    resetForm();
  };

  const handleEditEffect = (effect: ZoomEffect) => {
    setEditingEffect(effect);
    setStartTime(formatTime(effect.startTime));
    setEndTime(formatTime(effect.endTime));
    setZoomLevel(effect.zoomLevel);
    setCenterX(effect.x);
    setCenterY(effect.y);
  };

  const handleUpdateEffect = () => {
    if (!editingEffect) {
      return;
    }

    const updatedEffect: ZoomEffect = {
      ...editingEffect,
      startTime: parseTime(startTime),
      endTime: parseTime(endTime),
      zoomLevel,
      x: centerX,
      y: centerY,
    };

    const updatedEffects = zoomEffects.map((effect) =>
      effect.id === editingEffect.id ? updatedEffect : effect
    );

    onZoomEffectsChange(updatedEffects);
    setEditingEffect(null);
    resetForm();
  };

  const handleDeleteEffect = (id: string) => {
    onZoomEffectsChange(zoomEffects.filter((effect) => effect.id !== id));
  };

  const handleSetCurrentTime = () => {
    if (editingEffect) {
      setEndTime(formatTime(currentTime));
    } else {
      setStartTime(formatTime(currentTime));
    }
  };

  const handleAddTestEffect = () => {
    const testEffect: ZoomEffect = {
      id: Date.now().toString(),
      startTime: Math.max(0, currentTime - 5),
      endTime: Math.min(duration, currentTime + 5),
      zoomLevel: 2.0,
      x: 0.5,
      y: 0.5,
    };

    onZoomEffectsChange([...zoomEffects, testEffect]);
  };

  return {
    editingEffect,
    startTime,
    setStartTime,
    endTime,
    setEndTime,
    zoomLevel,
    setZoomLevel,
    centerX,
    setCenterX,
    centerY,
    setCenterY,
    resetForm,
    handleAddEffect,
    handleEditEffect,
    handleUpdateEffect,
    handleDeleteEffect,
    handleSetCurrentTime,
    handleAddTestEffect,
  };
}

export type UseZoomEffectForm = ReturnType<typeof useZoomEffectForm>;
