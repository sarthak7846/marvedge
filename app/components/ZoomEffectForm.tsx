import { Button } from "@/app/components/ui/button";
import { formatTime } from "@/app/lib/dateTimeUtils";
import { UseZoomEffectForm } from "./useZoomEffectForm";

interface ZoomEffectFormProps {
  form: UseZoomEffectForm;
  currentTime: number;
}

export default function ZoomEffectForm({ form, currentTime }: ZoomEffectFormProps) {
  const {
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
    handleUpdateEffect,
    handleSetCurrentTime,
    handleAddTestEffect,
  } = form;

  return (
    <div className="space-y-4 mb-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
          <input
            type="text"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            placeholder="0:00"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
          <input
            type="text"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            placeholder="0:00"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Zoom Level</label>
        <input
          type="range"
          min="1"
          max="5"
          step="0.1"
          value={zoomLevel}
          onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
          className="w-full"
        />
        <div className="text-sm text-gray-500 mt-1">{zoomLevel}x</div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Center Point</label>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">X Position</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={centerX}
              onChange={(e) => setCenterX(parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="text-xs text-gray-500">{Math.round(centerX * 100)}%</div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Y Position</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={centerY}
              onChange={(e) => setCenterY(parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="text-xs text-gray-500">{Math.round(centerY * 100)}%</div>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={handleSetCurrentTime}
          variant="outline"
          size="sm"
          className="btn-mini-cancel"
        >
          Set Current Time ({formatTime(currentTime)})
        </Button>
        <Button
          onClick={handleAddTestEffect}
          variant="outline"
          size="sm"
          className="btn-mini-cancel"
        >
          Add Test Effect
        </Button>
      </div>

      <div className="flex gap-2">
        {editingEffect ? (
          <>
            <Button onClick={handleUpdateEffect} className="flex-1 btn-mini-purple">
              Update Effect
            </Button>
            <Button onClick={resetForm} variant="outline" className="btn-mini-cancel">
              Cancel
            </Button>
          </>
        ) : (
          <Button
            onClick={handleAddEffect}
            disabled={!startTime || !endTime}
            className="flex-1 btn-mini-purple"
          >
            Add Effect
          </Button>
        )}
      </div>
    </div>
  );
}
