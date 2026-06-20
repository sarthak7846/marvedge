import React from "react";
import Image from "next/image";
import { ImageBackgroundOption } from "./backgroundOptions";

interface ImageBackgroundTabProps {
  filteredImageBackgroundOptions: ImageBackgroundOption[];
  localSelectedBackground: string | null;
  handleBackgroundSelect: (value: string | null) => void;
  customBackgroundUrl: string | null;
  localCustomBackground: File | null;
  localBackgroundType: string;
  setLocalBackgroundType: (value: string) => void;
  setBackgroundType?: (type: string) => void;
  handleCustomBackgroundUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const ImageBackgroundTab: React.FC<ImageBackgroundTabProps> = ({
  filteredImageBackgroundOptions,
  localSelectedBackground,
  handleBackgroundSelect,
  customBackgroundUrl,
  localCustomBackground,
  localBackgroundType,
  setLocalBackgroundType,
  setBackgroundType,
  handleCustomBackgroundUpload,
}) => {
  return (
    <>
      <div className="grid grid-cols-4 gap-2">
        {filteredImageBackgroundOptions.map((bg) => {
          const isActive = localSelectedBackground === bg.id;
          return (
            <button
              key={bg.id}
              onClick={() => handleBackgroundSelect(bg.id)}
              className={`bg-option-btn relative rounded-lg overflow-hidden border-2 transition-all ${
                isActive
                  ? "active border-[#7C5CFC] shadow-md"
                  : "border-[#ede7fa] hover:border-[#A594F9]"
              }`}
              title={bg.name}
            >
              <div className="w-full h-[60px] flex items-center justify-center bg-white">
                <Image
                  src={bg.thumbnail}
                  alt={bg.name}
                  width={80}
                  height={60}
                  className="w-full h-full object-cover"
                />
              </div>
              {isActive && (
                <div className="absolute top-1 right-1 w-4 h-4 bg-[#7C5CFC] rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full" />
                </div>
              )}
            </button>
          );
        })}

        {customBackgroundUrl && (
          <button
            onClick={() => handleBackgroundSelect("custom")}
            className={`relative rounded-lg overflow-hidden border-2 transition-all ${
              localSelectedBackground === "custom"
                ? "border-[#7C5CFC] shadow-md"
                : "border-[#ede7fa] hover:border-[#A594F9]"
            }`}
            title={localCustomBackground?.name || "Custom"}
          >
            <img src={customBackgroundUrl} alt="Custom" className="w-full h-[60px] object-cover" />
            {localSelectedBackground === "custom" && (
              <div className="absolute top-1 right-1 w-4 h-4 bg-[#7C5CFC] rounded-full flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full" />
              </div>
            )}
          </button>
        )}
      </div>

      <div className="mt-3">
        <label className="control-block-label block text-[#A594F9] font-semibold mb-2">
          Select Type
        </label>
        <select
          value={localBackgroundType}
          onChange={(e) => {
            setLocalBackgroundType(e.target.value);
            setBackgroundType?.(e.target.value);
          }}
          className="w-full border cursor-pointer border-[#ede7fa] rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#A594F9] text-[#7C5CFC]"
        >
          <option value="background">Image</option>
          <option value="solid">solid</option>
          <option value="gradient">gradient</option>
        </select>
      </div>

      <div className="mt-3">
        <label className="control-block-label block text-[#A594F9] font-semibold mb-2">
          Upload Custom Image
        </label>
        <div className="relative">
          <input
            type="file"
            accept="image/*"
            onChange={handleCustomBackgroundUpload}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="border border-[#ede7fa] rounded px-3 py-2 text-[#7C5CFC] flex items-center justify-between">
            <span className="text-sm">
              {localCustomBackground ? localCustomBackground.name : "Upload Custom Image"}
            </span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
        </div>
      </div>
    </>
  );
};

export default ImageBackgroundTab;
