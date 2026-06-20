import React from "react";
import { Button } from "../ui/button";
import { TrimSegment } from "./types";

export function SegmentButtons({
  segments,
  activeIdx,
  setActiveIdx,
  isDragging,
  dragIndex,
  dragOverIndex,
  handleDragStart,
  handleDragOver,
  handleDragEnter,
  handleDragLeave,
  handleDrop,
  handleDragEnd,
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
}: {
  segments: TrimSegment[];
  activeIdx: number;
  setActiveIdx: React.Dispatch<React.SetStateAction<number>>;
  isDragging: boolean;
  dragIndex: number | null;
  dragOverIndex: number | null;
  handleDragStart: (e: React.DragEvent, index: number) => void;
  handleDragOver: (e: React.DragEvent, index: number) => void;
  handleDragEnter: (e: React.DragEvent, index: number) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent, dropIndex: number) => void;
  handleDragEnd: () => void;
  handleMouseDown: (e: React.MouseEvent) => void;
  handleMouseMove: (e: React.MouseEvent, index: number) => void;
  handleMouseUp: () => void;
}) {
  return (
    <div className="mb-2">
      <div className="text-xs text-gray-500 mb-2 flex items-center gap-1">
        <span>📋</span>
        <span>Drag segments to reorder them</span>
        {isDragging && <span className="text-blue-500">(Dragging...)</span>}
        {dragIndex !== null && <span className="text-green-500">(From: {dragIndex + 1})</span>}
        {dragOverIndex !== null && (
          <span className="text-purple-500">(To: {dragOverIndex + 1})</span>
        )}
      </div>
      <div className="flex gap-2">
        {segments.map((seg, idx) => (
          <Button
            key={idx}
            variant={idx === activeIdx ? "default" : "outline"}
            onClick={() => {
              if (!isDragging) {
                setActiveIdx(idx);
              }
            }}
            draggable
            onDragStart={(e) => handleDragStart(e, idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDragEnter={(e) => handleDragEnter(e, idx)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, idx)}
            onDragEnd={handleDragEnd}
            onMouseDown={handleMouseDown}
            onMouseMove={(e) => handleMouseMove(e, idx)}
            onMouseUp={handleMouseUp}
            className={`text-xs px-3 py-1 rounded-full font-semibold transition-all duration-200 cursor-grab active:cursor-grabbing hover:scale-105 ${
              idx === activeIdx
                ? "bg-[#7C5CFC] text-white shadow-lg"
                : "bg-white text-[#7C5CFC] border border-[#7C5CFC] hover:bg-[#F6F3FF] hover:text-[#7C5CFC] hover:shadow-md"
            } ${
              dragOverIndex === idx ? "ring-2 ring-[#7C5CFC] ring-opacity-50 scale-110" : ""
            } ${dragIndex === idx ? "opacity-50 scale-95 shadow-xl" : ""}`}
          >
            Segment {idx + 1}
          </Button>
        ))}
      </div>
    </div>
  );
}
