"use client";
import Image from "next/image";
import { FaShareAlt, FaRegCalendarAlt } from "react-icons/fa";
import { formatDate } from "@/app/lib/dateTimeUtils";
import type { ExportedVideo } from "../types";

interface VideoGridViewProps {
  videos: ExportedVideo[];
  onOpen: (url: string) => void;
  onDelete: (id: string) => void;
  onShare: (video: ExportedVideo) => void;
}

export default function VideoGridView({ videos, onOpen, onDelete, onShare }: VideoGridViewProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-8">
      {videos.map((video) => (
        <div
          key={video.id}
          className="shared-card bg-white rounded-2xl p-4 flex flex-col h-full shadow-sm cursor-pointer hover:shadow-md transition"
          onClick={() => onOpen(video.exportedUrl)}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="shared-card-title text-2xl text-[#8B8B8B] font-normal">
              {video.title}
            </div>
            <button
              className="text-red-400 hover:text-red-600 text-xl flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(video.id);
              }}
            >
              <Image
                src="/icons/delete-demo.svg"
                alt="Delete"
                width={24}
                height={24}
                className="w-6 h-6"
              />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center rounded-xl mb-4 min-h-[220px] overflow-hidden">
            <Image
              src="/LargeMarvedge.png"
              alt="Video thumbnail"
              width={800}
              height={450}
              className="w-full h-full object-cover rounded-xl"
            />
          </div>
          <div className="flex items-center justify-between text-[#8B8B8B] text-base mb-2">
            <div className="shared-card-desc flex-1 truncate text-sm">
              {video.description || "No description"}
            </div>
            <div className="shared-card-date flex items-center gap-2 flex-shrink-0 ml-4">
              <FaRegCalendarAlt className="text-lg" /> {formatDate(video.updatedAt)}
            </div>
            <div className="shared-card-desc ml-4 flex-shrink-0">Published</div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onShare(video);
            }}
            className="shared-btn bg-[#A594F9] text-white rounded-lg px-6 py-3 w-full text-lg font-medium flex items-center justify-center gap-2 mt-auto cursor-pointer"
          >
            <FaShareAlt /> Share
          </button>
        </div>
      ))}
    </div>
  );
}
