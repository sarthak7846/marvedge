import Image from "next/image";
import React, { RefObject } from "react";

type PhotoUploadCardProps = {
  isDragging: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onClose: () => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
};

export default function PhotoUploadCard({
  isDragging,
  fileInputRef,
  onClose,
  onDragOver,
  onDragLeave,
  onDrop,
}: PhotoUploadCardProps) {
  return (
    <div
      className="fixed inset-0 backdrop-blur-lg bg-white/15 flex items-center justify-center z-50 p-4"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={`bg-[#F3F0FC] rounded-3xl max-w-md w-full p-12 border-2 transition-all ${
          isDragging
            ? "border-solid border-[#7C5CFC] bg-[#FFFBFE] shadow-lg"
            : "border-dashed border-[#A594F9]"
        }`}
      >
        <div className="flex flex-col items-center pointer-events-none">
          <Image
            src="/icons/zondicons_upload.png"
            alt="Upload"
            width={56}
            height={56}
            className={`mb-6 transition-transform ${isDragging ? "scale-110" : ""}`}
          />

          <h3 className="text-lg font-semibold text-gray-800 mb-3 text-center">
            {isDragging ? "Drop your image here" : "Drag and Drop files to upload"}
          </h3>

          <p className="text-gray-500 text-center mb-5">or</p>
        </div>

        <button
          type="button"
          onClick={() => {
            onClose();
            fileInputRef.current?.click();
          }}
          className="w-full px-8 py-2.5 bg-[#7C5CFC] text-white font-semibold rounded-lg hover:bg-[#8A76FC] transition mb-4"
        >
          Browse
        </button>

        <p className="text-gray-500 text-xs text-center">Supported files: JPEG, PNG, GIF</p>
        <p className="text-red-500 text-xs text-center">Max file size: 3MB</p>
      </div>
    </div>
  );
}
