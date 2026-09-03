"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MainTab } from "./backgroundOptions";

interface SidebarTabsProps {
  tabs: { id: MainTab; label: string }[];
  activeTab: MainTab;
  setActiveTab: (tab: MainTab) => void;
}

const SidebarTabs: React.FC<SidebarTabsProps> = ({ tabs, activeTab, setActiveTab }) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const syncArrows = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) {
      return;
    }
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft < maxScroll - 1);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) {
      return;
    }
    syncArrows();
    const observer = new ResizeObserver(syncArrows);
    observer.observe(el);
    return () => observer.disconnect();
  }, [syncArrows, tabs.length]);

  // Keep the selected tab visible when it changes (e.g. switched from elsewhere).
  useEffect(() => {
    const el = scrollerRef.current;
    const active = el?.querySelector<HTMLElement>(`[data-tab="${activeTab}"]`);
    active?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [activeTab]);

  const scrollByStep = (direction: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) {
      return;
    }
    el.scrollBy({ left: direction * Math.max(el.clientWidth * 0.7, 96), behavior: "smooth" });
  };

  return (
    <div className="tab-switcher flex items-center gap-1 bg-[#F6F3FF] rounded-full p-1">
      <button
        type="button"
        onClick={() => scrollByStep(-1)}
        disabled={!canScrollLeft}
        aria-label="Scroll tabs left"
        className={`shrink-0 h-7 w-7 rounded-full flex items-center justify-center transition ${
          canScrollLeft
            ? "text-[#7C5CFC] hover:bg-white hover:shadow-sm cursor-pointer"
            : "text-[#C9BDF5] cursor-not-allowed"
        }`}
      >
        <ChevronLeft size={16} strokeWidth={2.5} />
      </button>

      <div
        ref={scrollerRef}
        onScroll={syncArrows}
        className="flex-1 min-w-0 flex items-center gap-1 overflow-x-auto scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            data-tab={tab.id}
            type="button"
            className={`tab-item shrink-0 cursor-pointer whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-semibold transition ${
              activeTab === tab.id
                ? "active bg-white text-[#7C5CFC] shadow"
                : "text-[#8B7BC8] hover:text-[#7C5CFC]"
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => scrollByStep(1)}
        disabled={!canScrollRight}
        aria-label="Scroll tabs right"
        className={`shrink-0 h-7 w-7 rounded-full flex items-center justify-center transition ${
          canScrollRight
            ? "text-[#7C5CFC] hover:bg-white hover:shadow-sm cursor-pointer"
            : "text-[#C9BDF5] cursor-not-allowed"
        }`}
      >
        <ChevronRight size={16} strokeWidth={2.5} />
      </button>
    </div>
  );
};

export default SidebarTabs;
