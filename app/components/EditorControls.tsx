"use client";
import { useState } from "react";

type EditorControlsProps = {
  onTrim: (start: string, end: string) => void;
  processing: boolean;
};

const EditorControls = ({ onTrim, processing }: EditorControlsProps) => {
  const [start, setStart] = useState("00:00:00");
  const [end, setEnd] = useState("00:00:10");

  const handleTrim = () => {
    onTrim(start, end);
  };

  return (
    <div className="space-y-4 bg-gray-100 p-4 rounded">
      <h2 className="font-bold text-lg">Trim Video</h2>

      <div>
        <label className="block mb-1">Start Time (HH:MM:SS)</label>
        <input
          type="text"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="border p-2 w-full rounded"
          placeholder="00:00:00"
        />
      </div>

      <div>
        <label className="block mb-1">End Time (HH:MM:SS)</label>
        <input
          type="text"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          className="border p-2 w-full rounded"
          placeholder="00:00:10"
        />
      </div>

      <button
        onClick={handleTrim}
        disabled={processing}
        className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {processing ? "Trimming..." : "Trim Video"}
      </button>
    </div>
  );
};

export default EditorControls;
