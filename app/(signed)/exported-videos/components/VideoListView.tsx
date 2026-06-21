"use client";
import Image from "next/image";
import { FaShareAlt } from "react-icons/fa";
import { formatDate } from "@/app/lib/dateTimeUtils";
import type { ExportedVideo } from "../types";

interface VideoListViewProps {
  videos: ExportedVideo[];
  onOpen: (url: string) => void;
  onDelete: (id: string) => void;
  onShare: (video: ExportedVideo) => void;
}

export default function VideoListView({ videos, onOpen, onDelete, onShare }: VideoListViewProps) {
  return (
    <div className="shared-table-container bg-white rounded-2xl overflow-hidden">
      <table className="w-full text-left">
        <thead className="shared-table-head bg-[#F3F0FC] text-[#8B8B8B] text-lg">
          <tr>
            <th className="py-4 px-6 font-medium">Videos</th>
            <th className="py-4 px-6 font-medium">Status</th>
            <th className="py-4 px-6 font-medium">Updated</th>
            <th className="py-4 px-6 font-medium text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {videos.map((video) => (
            <tr
              key={video.id}
              className="shared-table-row border-t border-[#F3F0FC] hover:bg-[#F8F6FF] cursor-pointer"
              onClick={() => onOpen(video.exportedUrl)}
            >
              <td className="py-4 px-6 flex items-center gap-4">
                <span className="inline-flex items-center justify-center w-14 h-14 rounded-xl overflow-hidden bg-white dark:bg-gradient-to-br dark:from-[#8a63ff] dark:to-[#5c38f7] border border-[#E9E4F5] dark:border-none shadow-sm shrink-0">
                  <Image
                    src="/images/Transparent logo.png"
                    alt="Video thumbnail"
                    width={28}
                    height={28}
                    className="w-7 h-7 object-contain dark:hidden block"
                  />
                  <Image
                    src="/images/Transparent logo.png"
                    alt="Video thumbnail"
                    width={28}
                    height={28}
                    className="w-7 h-7 object-contain brightness-0 invert dark:block hidden"
                  />
                </span>
                <div>
                  <div className="shared-table-text-primary font-semibold text-lg text-[#1A0033]">
                    {video.title}
                  </div>
                  <div className="shared-table-text-muted text-[#8B8B8B] text-sm">
                    {video.description || "No description"}
                  </div>
                </div>
              </td>
              <td className="shared-table-text-muted py-4 px-6 text-[#8B8B8B] font-medium">
                Published
              </td>
              <td className="shared-table-text-muted py-4 px-6 text-[#8B8B8B] font-medium">
                {formatDate(video.updatedAt)}
              </td>
              <td className="py-4 px-6">
                <div className="flex gap-4 items-center justify-center">
                  <button
                    className="text-[#A594F9] hover:text-[#7C6FEF] text-xl cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onShare(video);
                    }}
                  >
                    <FaShareAlt />
                  </button>
                  <button
                    className="text-red-400 hover:text-red-600 text-xl cursor-pointer"
                    type="button"
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
