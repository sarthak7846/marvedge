"use client";
import { useState, useRef, useEffect } from "react";
import { FaTh, FaThList, FaSort, FaEye, FaListUl, FaRegClock, FaPlusSquare } from "react-icons/fa";
import { useShallow } from "zustand/react/shallow";
import { useDemosStore } from "@/app/store/demosStore";
import type { DemoSortOption } from "../types";

export default function DemosToolbar() {
  const { search, setSearch, sortOption, setSortOption, view, setView } = useDemosStore(
    useShallow((s) => ({
      search: s.search,
      setSearch: s.setSearch,
      sortOption: s.sortOption,
      setSortOption: s.setSortOption,
      view: s.view,
      setView: s.setView,
    }))
  );

  // Dropdown open/close is local UI state; its DOM node stays a ref.
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const sortDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        setSortDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectSort = (option: DemoSortOption) => {
    setSortOption(option);
    setSortDropdownOpen(false);
  };

  const optionClass = (option: DemoSortOption) =>
    `flex items-center gap-3 text-base font-medium cursor-pointer px-2 py-2 rounded-lg hover:bg-[#F3F0FC] ${sortOption === option ? "text-purple-700 bg-purple-50 active-sort" : "text-[#A594F9]"}`;

  return (
    <div className="flex flex-wrap items-center justify-between mt-6 gap-4">
      <input
        type="text"
        placeholder="Search your demos"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="demos-search flex-1 min-w-[300px] px-4 py-3 rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#A594F9]"
      />

      <div className="flex items-center gap-6 ml-auto">
        <div className="relative">
          <button
            className="demos-sort-btn flex items-center gap-2 px-6 py-3 rounded-lg bg-white border border-gray-200 text-[#A594F9] font-medium hover:bg-[#ede7fa]"
            onClick={() => setSortDropdownOpen((v) => !v)}
          >
            <FaSort className="text-lg" /> Sort By
          </button>
          {sortDropdownOpen && (
            <div
              ref={sortDropdownRef}
              className="demos-dropdown-menu absolute left-0 top-full mt-2 bg-white rounded-2xl shadow-lg p-4 z-50 border border-gray-100 min-w-[180px] animate-fade-in"
            >
              <div className="flex flex-col gap-2">
                <div onClick={() => selectSort("title")} className={optionClass("title")}>
                  <FaListUl className="text-lg" /> Title
                </div>
                <div onClick={() => selectSort("updatedAt")} className={optionClass("updatedAt")}>
                  <FaRegClock className="text-lg" /> Last Updated
                </div>
                <div onClick={() => selectSort("createdAt")} className={optionClass("createdAt")}>
                  <FaPlusSquare className="text-lg" /> Created date
                </div>
                <div onClick={() => selectSort("views")} className={optionClass("views")}>
                  <FaEye className="text-lg" /> Views
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            className={`p-3 rounded-lg border transition-all ${
              view === "grid"
                ? "bg-[#A594F9] text-white dark:bg-[var(--purple-primary)] dark:border-[var(--purple-primary)]"
                : "bg-white text-[#A594F9] border-gray-200 dark:bg-[var(--bg-card)] dark:border-[var(--border-primary)] dark:text-[var(--purple-light)]"
            }`}
            onClick={() => setView("grid")}
          >
            <FaTh className="text-xl" />
          </button>
          <button
            className={`p-3 rounded-lg border transition-all ${
              view === "list"
                ? "bg-[#A594F9] text-white dark:bg-[var(--purple-primary)] dark:border-[var(--purple-primary)]"
                : "bg-white text-[#A594F9] border-gray-200 dark:bg-[var(--bg-card)] dark:border-[var(--border-primary)] dark:text-[var(--purple-light)]"
            }`}
            onClick={() => setView("list")}
          >
            <FaThList className="text-xl" />
          </button>
        </div>
      </div>
    </div>
  );
}
