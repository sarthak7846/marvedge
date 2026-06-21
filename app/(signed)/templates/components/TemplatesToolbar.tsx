"use client";
import Image from "next/image";
import { sortOptions } from "../templateData";

interface TemplatesToolbarProps {
  search: string;
  setSearch: (value: string) => void;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  sortDropdownRef: React.RefObject<HTMLDivElement | null>;
  levelDropdownOpen: boolean;
  setLevelDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  levelDropdownRef: React.RefObject<HTMLDivElement | null>;
}

export default function TemplatesToolbar({
  search,
  setSearch,
  open,
  setOpen,
  sortDropdownRef,
  levelDropdownOpen,
  setLevelDropdownOpen,
  levelDropdownRef,
}: TemplatesToolbarProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 md:gap-4 mt-3 sm:mt-4 mb-4 sm:mb-6 w-full max-w-full">
      <div className="relative flex-1 w-full sm:max-w-xl">
        <input
          type="text"
          placeholder="Search templates"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 sm:px-5 py-2 sm:py-3 rounded-xl border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#A594F9] shadow-sm pr-12 text-xs sm:text-base"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 md:gap-4 w-full sm:w-auto">
        <button className="flex items-center gap-1 sm:gap-2 px-3 sm:px-6 py-2 sm:py-3 rounded-lg bg-white border border-gray-200 text-[#A594F9] font-medium hover:bg-[#ede7fa] text-xs sm:text-sm">
          <Image
            src="/icons/down-arrow.svg"
            alt="Notifications"
            width={24}
            height={24}
            className="w-4 h-4 sm:w-6 sm:h-6"
          />
          <span className="hidden sm:inline">All Categories</span>
          <span className="sm:hidden">Categories</span>
        </button>
        <div className="relative" ref={sortDropdownRef}>
          <button
            className="flex items-center gap-1 sm:gap-2 px-3 sm:px-6 py-2 sm:py-3 rounded-lg bg-white border border-gray-200 text-[#A594F9] font-medium hover:bg-[#ede7fa] text-xs sm:text-sm"
            onClick={() => setOpen((prev) => !prev)}
          >
            <span className="material-icons"></span>
            <Image
              src="/icons/sort.svg"
              alt="Notifications"
              width={24}
              height={24}
              className="w-4 h-4 sm:w-6 sm:h-6"
            />
            <span className="hidden sm:inline">Sort By</span>
            <span className="sm:hidden">Sort</span>
          </button>
          {open && (
            <div className="absolute left-0 mt-2 w-40 sm:w-48 bg-white rounded-xl shadow-lg border border-gray-100 z-10">
              {sortOptions.map((option) => (
                <button
                  key={option.label}
                  className="flex items-center gap-2 sm:gap-3 w-full px-3 sm:px-5 py-2 sm:py-3 text-gray-700 hover:bg-[#f3f0fa] transition text-xs sm:text-sm"
                  onClick={() => {
                    // handle sort logic here
                    setOpen(false);
                  }}
                >
                  <span className="w-4 h-4 sm:w-6 sm:h-6">{option.icon}</span>
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="relative">
          <button
            className="flex items-center gap-1 sm:gap-2 px-3 sm:px-6 py-2 sm:py-3 rounded-lg bg-white border border-gray-200 text-[#A594F9] font-medium hover:bg-[#ede7fa] text-xs sm:text-sm"
            onClick={() => setLevelDropdownOpen((v) => !v)}
          >
            <Image
              src="/icons/filter.svg"
              alt="Notifications"
              width={24}
              height={24}
              className="w-4 h-4 sm:w-6 sm:h-6"
            />
            <span className="hidden sm:inline">All levels</span>
            <span className="sm:hidden">Filter</span>
          </button>
          {levelDropdownOpen && (
            <div
              ref={levelDropdownRef}
              className="absolute left-0 top-full mt-2 bg-white rounded-2xl shadow-lg z-50 border border-gray-100 min-w-40 animate-fade-in"
            >
              <div className="flex flex-col divide-y divide-gray-100">
                <div className="px-4 sm:px-6 py-2 sm:py-3 cursor-pointer text-center text-green-500 font-medium hover:bg-[#F3F0FC] rounded-t-2xl text-xs sm:text-sm">
                  Beginner
                </div>
                <div className="px-4 sm:px-6 py-2 sm:py-3 cursor-pointer text-center text-yellow-500 font-medium hover:bg-[#F3F0FC] text-xs sm:text-sm">
                  Intermediate
                </div>
                <div className="px-4 sm:px-6 py-2 sm:py-3 cursor-pointer text-center text-red-500 font-medium hover:bg-[#F3F0FC] rounded-b-2xl text-xs sm:text-sm">
                  Advanced
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
