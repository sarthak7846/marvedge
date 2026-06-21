"use client";
import { X } from "lucide-react";
import { ZoomEffect } from "../types/editor/zoom-effect";
import { useZoomEffectForm } from "./useZoomEffectForm";
import ZoomEffectForm from "./ZoomEffectForm";
import ZoomEffectList from "./ZoomEffectList";

interface ZoomEffectsPopupProps {
  isOpen: boolean;
  onClose: () => void;
  zoomEffects: ZoomEffect[];
  onZoomEffectsChange: (effects: ZoomEffect[]) => void;
  currentTime: number;
  duration: number;
  onSeek?: (time: number) => void;
}

export default function ZoomEffectsPopup({
  isOpen,
  onClose,
  zoomEffects,
  onZoomEffectsChange,
  currentTime,
  duration,
}: ZoomEffectsPopupProps) {
  const form = useZoomEffectForm({
    zoomEffects,
    onZoomEffectsChange,
    currentTime,
    duration,
  });

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-800">Zoom Effects</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        <ZoomEffectForm form={form} currentTime={currentTime} />

        <ZoomEffectList
          zoomEffects={zoomEffects}
          onEdit={form.handleEditEffect}
          onDelete={form.handleDeleteEffect}
        />
      </div>
    </div>
  );
}
