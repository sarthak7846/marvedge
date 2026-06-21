"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X, Star } from "lucide-react";
import { useTheme } from "next-themes";
import ReviewModal from "./ReviewModal";
import SidebarBrand from "./sidemenu/SidebarBrand";
import SidebarNav from "./sidemenu/SidebarNav";

const SidemenuDashboard = () => {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const effectiveTheme = theme === "system" ? resolvedTheme : theme;
  const isDark = mounted && effectiveTheme === "dark";

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      <button
        onClick={toggleMobileMenu}
        className="md:hidden fixed top-3 sm:top-4 left-3 sm:left-4 z-40 bg-[#6356d7] text-white p-1.5 sm:p-2 rounded-md shadow-lg"
        aria-label="Toggle menu"
      >
        <Menu size={20} className="sm:w-6 sm:h-6" />
      </button>

      {isMobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={closeMobileMenu}
        />
      )}

      <div
        className={`w-56 sm:w-64 md:w-72 h-screen flex flex-col fixed top-0 left-0 z-30 overflow-y-auto transition-transform duration-300 ease-in-out ${
          isDark ? "sidebar" : "bg-[#6356d7]"
        } ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 text-white p-3 sm:p-6`}
      >
        <button
          onClick={closeMobileMenu}
          className="md:hidden absolute top-2 sm:top-4 right-2 sm:right-4 text-white hover:text-gray-300"
          aria-label="Close menu"
        >
          <X size={20} className="sm:w-6 sm:h-6" />
        </button>

        <div className="flex flex-col justify-between h-full min-h-0 flex-1">
          <div>
            <SidebarBrand isDark={isDark} onNavigate={closeMobileMenu} />
            <SidebarNav isDark={isDark} pathname={pathname} onNavigate={closeMobileMenu} />
          </div>

          <div className="mt-auto pt-6 pb-2">
            <button
              onClick={() => setIsReviewModalOpen(true)}
              className={`w-full flex items-center justify-start gap-1 sm:gap-4 transition-colors cursor-pointer text-xs sm:text-base font-medium ${
                isDark
                  ? "review-link rounded-lg h-8 sm:h-10 px-1 sm:px-2 border border-transparent"
                  : "text-white hover:bg-[#bcb3f7] rounded-lg h-8 sm:h-10 px-1 sm:px-2 border border-transparent"
              }`}
            >
              <span className="flex items-center justify-center shrink-0 w-5 sm:w-7">
                <Star size={18} />
              </span>
              <span>Review Marvedge</span>
            </button>
          </div>
        </div>
      </div>
      <ReviewModal isOpen={isReviewModalOpen} onClose={() => setIsReviewModalOpen(false)} />
    </>
  );
};

export default SidemenuDashboard;
