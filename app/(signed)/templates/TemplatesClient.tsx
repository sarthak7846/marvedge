"use client";
import React, { useState, useRef, useEffect } from "react";
import { templates } from "./templateData";
import TemplatesToolbar from "./components/TemplatesToolbar";
import TemplateCard from "./components/TemplateCard";

export const metadata = {
  titleText: "Explore Templates",
  iconSRC: "/icons/explore-templates.svg",
};

export default function TemplatesPage() {
  const [search, setSearch] = useState("");
  const [levelDropdownOpen, setLevelDropdownOpen] = useState(false);
  const levelDropdownRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (levelDropdownRef.current && !levelDropdownRef.current.contains(event.target as Node)) {
        setLevelDropdownOpen(false);
      }
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="min-h-screen bg-[#F3F0FC]">
      <div
        className="p-2 sm:p-4 md:p-6 lg:p-8 bg-[#F3F0FC] h-full overflow-y-auto"
        style={{ minHeight: "calc(100vh - 80px)" }}
      >
        <div className="mb-4 sm:mb-6">
          <p className="text-[#8B8B8B] text-xs sm:text-sm md:text-base lg:text-lg">
            For faster demo creation use the professionally designed templates.
          </p>
          <TemplatesToolbar
            search={search}
            setSearch={setSearch}
            open={open}
            setOpen={setOpen}
            sortDropdownRef={ref}
            levelDropdownOpen={levelDropdownOpen}
            setLevelDropdownOpen={setLevelDropdownOpen}
            levelDropdownRef={levelDropdownRef}
          />
        </div>
        <div className="mb-3 sm:mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
          <h3 className="text-lg sm:text-xl md:text-2xl font-semibold text-[#1A0033]">Templates</h3>
          <span className="text-[#8B8B8B] font-medium text-xs sm:text-sm">
            {templates.length}/6 demos
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6 lg:gap-8">
          {templates.map((tpl) => (
            <TemplateCard key={tpl.title} tpl={tpl} />
          ))}
        </div>
      </div>
    </div>
  );
}
