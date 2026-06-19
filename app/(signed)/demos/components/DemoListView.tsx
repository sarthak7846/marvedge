"use client";
import Image from "next/image";
import { formatDate } from "@/app/lib/dateTimeUtils";
import type { Demo } from "../types";

interface DemoListViewProps {
  demos: Demo[];
  onEdit: (demo: Demo) => void;
  onDelete: (id: string) => void;
}

export default function DemoListView({ demos, onEdit, onDelete }: DemoListViewProps) {
  return (
    <div className="bg-white dark:bg-[var(--bg-card)] dark:border dark:border-[var(--border-primary)] rounded-2xl overflow-hidden">
      <table className="w-full text-left">
        <thead className="bg-[#F3F0FC] dark:bg-[var(--panel-primary)] text-[#8B8B8B] dark:text-[var(--text-muted)] text-lg">
          <tr>
            <th className="py-4 px-6 font-medium">Demos</th>

            <th className="py-4 px-6 font-medium">Status</th>
            <th className="py-4 px-6 font-medium">Updated</th>
            <th className="py-4 px-6 font-medium text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {demos.map((demo: Demo) => (
            <tr
              key={demo.id}
              className="border-t border-[#F3F0FC] dark:border-[var(--border-primary)] hover:bg-[#F8F6FF] dark:hover:bg-[var(--active-start)]/30 cursor-pointer"
              onClick={() => onEdit(demo)}
            >
              <td className="py-4 px-6 flex items-center gap-4">
                <span className="inline-flex items-center justify-center w-14 h-14 rounded-xl overflow-hidden bg-white dark:bg-gradient-to-br dark:from-[#8a63ff] dark:to-[#5c38f7] border border-[#E9E4F5] dark:border-none shadow-sm shrink-0">
                  <Image
                    src="/images/Transparent logo.png"
                    alt="Demo thumbnail"
                    width={28}
                    height={28}
                    className="w-7 h-7 object-contain dark:hidden block"
                  />
                  <Image
                    src="/images/Transparent logo.png"
                    alt="Demo thumbnail"
                    width={28}
                    height={28}
                    className="w-7 h-7 object-contain brightness-0 invert dark:block hidden"
                  />
                </span>
                <div>
                  <div className="font-semibold text-lg text-[#1A0033] dark:text-[var(--text-primary)]">
                    {demo.title}
                  </div>
                  <div className="text-[#8B8B8B] dark:text-[var(--text-muted)] text-sm">
                    {demo.description || "No description"}
                  </div>
                </div>
              </td>

              <td className="py-4 px-6 text-[#8B8B8B] dark:text-[var(--text-soft)] font-medium">
                Draft
              </td>
              <td className="py-4 px-6 text-[#8B8B8B] dark:text-[var(--text-soft)] font-medium">
                {formatDate(demo.updatedAt)}
              </td>
              <td className="py-4 px-6">
                <div className="flex items-center justify-center">
                  <button
                    className="text-red-400 hover:text-red-600 text-xl cursor-pointer"
                    type="button"
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
