"use client";
import Image from "next/image";
import { FaRegCalendarAlt, FaRegClock } from "react-icons/fa";
import { formatDate } from "@/app/lib/dateTimeUtils";
import type { Demo } from "../types";

interface DemoGridViewProps {
  demos: Demo[];
  durationMap: Record<string, string>;
  onEdit: (demo: Demo) => void;
  onDelete: (id: string) => void;
}

export default function DemoGridView({ demos, durationMap, onEdit, onDelete }: DemoGridViewProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-8">
      {demos.map((demo: Demo) => (
        <div
          key={demo.id}
          className="demos-card bg-white rounded-2xl p-4 flex flex-col h-full shadow-sm cursor-pointer hover:shadow-md transition"
          onClick={() => onEdit(demo)}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="text-2xl text-[#8B8B8B] dark:text-[var(--text-primary)] font-normal">
              {demo.title}
            </div>
            <button
              className="text-red-400 hover:text-red-600 text-xl flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(demo.id);
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
              alt="Demo thumbnail"
              width={800}
              height={450}
              className="w-full h-full object-cover rounded-xl"
            />
          </div>
          <div className="flex items-center justify-between text-[#8B8B8B] dark:text-[var(--text-soft)] text-base mb-2">
            <div className="flex items-center gap-2">
              <FaRegClock className="text-lg" /> {durationMap[demo.id] || "..."}
            </div>
            <div className="flex items-center gap-2">
              <FaRegCalendarAlt className="text-lg" /> {formatDate(demo.updatedAt)}
            </div>
            <div>Draft</div>
          </div>
          <div className="text-sm text-[#8B8B8B] dark:text-[var(--text-muted)] truncate">
            {demo.description || "No description"}
          </div>
        </div>
      ))}
    </div>
  );
}
