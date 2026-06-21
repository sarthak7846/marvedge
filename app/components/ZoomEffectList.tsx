import { Button } from "@/app/components/ui/button";
import { Trash2 } from "lucide-react";
import { formatTime } from "@/app/lib/dateTimeUtils";
import { ZoomEffect } from "../types/editor/zoom-effect";

interface ZoomEffectListProps {
  zoomEffects: ZoomEffect[];
  onEdit: (effect: ZoomEffect) => void;
  onDelete: (id: string) => void;
}

export default function ZoomEffectList({ zoomEffects, onEdit, onDelete }: ZoomEffectListProps) {
  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Current Effects</h3>
      {zoomEffects.length === 0 ? (
        <p className="text-gray-500 text-center py-4">No zoom effects added yet.</p>
      ) : (
        <div className="space-y-2">
          {zoomEffects.map((effect) => (
            <div
              key={effect.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex-1">
                <div className="font-medium">
                  {formatTime(effect.startTime)} - {formatTime(effect.endTime)}
                </div>
                <div className="text-sm text-gray-500">
                  Zoom: {effect.zoomLevel}x | Center: ({Math.round(effect.x * 100)}%,{" "}
                  {Math.round(effect.y * 100)}%)
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => onEdit(effect)}
                  variant="outline"
                  size="sm"
                  className="btn-mini-cancel"
                >
                  Edit
                </Button>
                <Button
                  onClick={() => onDelete(effect.id)}
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
