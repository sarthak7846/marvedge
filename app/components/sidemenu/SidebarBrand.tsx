import React from "react";
import Link from "next/link";
import Image from "next/image";

interface SidebarBrandProps {
  isDark: boolean;
  onNavigate: () => void;
}

const SidebarBrand = ({ isDark, onNavigate }: SidebarBrandProps) => (
  <>
    <div
      className={`flex cursor-pointer items-center justify-center gap-2 sm:gap-3 mb-4 sm:mb-6 mt-8 sm:mt-0 ${
        isDark ? "logo" : "text-white"
      }`}
      onClick={() => {
        window.location.href = "/";
      }}
    >
      <Image
        src="/images/Transparent logo.png"
        alt="Marvedge logo"
        width={32}
        height={32}
        className="object-contain brightness-0 invert sm:w-10 sm:h-10"
        priority
      />
      <h2 className="text-lg sm:text-2xl h-full flex items-center font-light">
        MARV{isDark ? <span>EDGE</span> : "EDGE"}
      </h2>
    </div>

    <Link href="/recorder" onClick={onNavigate} className="w-full">
      <button
        className={`w-full cursor-pointer flex items-center justify-center gap-3 transition-all ${
          isDark
            ? "create-demo-btn py-1.5 sm:py-2 rounded-[15px] text-xs sm:text-base font-semibold"
            : "bg-white text-purple-900 py-1.5 sm:py-2 rounded-[15px] shadow-md text-xs sm:text-base hover:bg-gray-100"
        } mb-4 sm:mb-6`}
      >
        <Image
          src="/material-symbols_add-rounded.png"
          alt="Add"
          width={20}
          height={20}
          className={`sm:w-6 sm:h-6 ${isDark ? "brightness-0 invert" : ""}`}
        />
        <span className={`hidden sm:inline font-bold ${isDark ? "text-white" : "text-black"}`}>
          Create Demo
        </span>
      </button>
    </Link>
  </>
);

export default SidebarBrand;
