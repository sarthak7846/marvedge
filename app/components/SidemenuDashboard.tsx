"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Settings, Share2, Star } from "lucide-react";
import Image from "next/image";
import { useTheme } from "next-themes";
import ReviewModal from "./ReviewModal";

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

  const isActive = (path: string) => {
    return pathname === path;
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const activeClass = isDark
    ? "menu-item active font-light rounded-lg h-8 sm:h-10 px-1 sm:px-2"
    : "bg-[#bcb3f7] border border-transparent text-white font-light rounded-lg shadow-sm h-8 sm:h-10 px-1 sm:px-2";

  const inactiveClass = isDark
    ? "menu-item font-light rounded-lg h-8 sm:h-10 px-1 sm:px-2"
    : "text-white border border-transparent font-light hover:bg-[#bcb3f7] rounded-lg h-8 sm:h-10 px-1 sm:px-2";

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

            <Link href="/recorder" onClick={closeMobileMenu} className="w-full">
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
                <span
                  className={`hidden sm:inline font-bold ${isDark ? "text-white" : "text-black"}`}
                >
                  Create Demo
                </span>
              </button>
            </Link>

            <ul className="space-y-1 sm:space-y-2 text-sm sm:text-lg font-medium">
              <Link href="/dashboard" onClick={closeMobileMenu}>
                <li
                  className={`flex items-center justify-start gap-1 sm:gap-4 transition-colors cursor-pointer text-xs sm:text-base ${
                    isActive("/dashboard") ? activeClass : inactiveClass
                  }`}
                >
                  <span className="flex items-center justify-center shrink-0 w-5 sm:w-7">
                    <Image
                      src="/icons/dash-home.svg"
                      alt="Dashboard"
                      width={22}
                      height={22}
                      className={`object-contain w-5 h-5 sm:w-[30px] sm:h-[30px] ${
                        isDark ? "brightness-0 invert" : ""
                      }`}
                      priority
                    />
                  </span>
                  <span>Dashboard</span>
                </li>
              </Link>
              <Link href="/demos" onClick={closeMobileMenu}>
                <li
                  className={`flex items-center justify-start gap-1 sm:gap-4 transition-colors cursor-pointer text-xs sm:text-base ${
                    isActive("/demos") ? activeClass : inactiveClass
                  }`}
                >
                  <span className="flex items-center justify-center shrink-0 w-5 sm:w-7">
                    <Image
                      src="/icons/dash-play.svg"
                      alt="Demos"
                      width={22}
                      height={22}
                      className={`object-contain w-5 h-5 sm:w-[30px] sm:h-[30px] ${
                        isDark ? "brightness-0 invert" : ""
                      }`}
                      priority
                    />
                  </span>
                  <span>My Demos</span>
                </li>
              </Link>
              <Link href="/exported-videos" onClick={closeMobileMenu}>
                <li
                  className={`flex items-center justify-start gap-1 sm:gap-4 transition-colors cursor-pointer text-xs sm:text-base ${
                    isActive("/exported-videos") ? activeClass : inactiveClass
                  }`}
                >
                  <span className="flex items-center justify-center shrink-0 w-5 sm:w-7">
                    <Share2 size={18} />
                  </span>
                  <span>Shared Videos</span>
                </li>
              </Link>
              <Link href="/analytics" onClick={closeMobileMenu}>
                <li
                  className={`flex items-center justify-start gap-1 sm:gap-4 transition-colors cursor-pointer text-xs sm:text-base ${
                    isActive("/analytics") ? activeClass : inactiveClass
                  }`}
                >
                  <span className="flex items-center justify-center shrink-0 w-5 sm:w-7">
                    <Image
                      src="/icons/dash-analytics.svg"
                      alt="Analytics"
                      width={18}
                      height={18}
                      className={`object-contain w-5 h-5 sm:w-5 sm:h-5 ${
                        isDark ? "brightness-0 invert" : ""
                      }`}
                    />
                  </span>
                  <span>Analytics</span>
                </li>
              </Link>
              <Link href="/settings" onClick={closeMobileMenu}>
                <li
                  className={`flex items-center justify-start gap-1 sm:gap-4 transition-colors cursor-pointer text-xs sm:text-base ${
                    isActive("/settings") ? activeClass : inactiveClass
                  }`}
                >
                  <span className="flex items-center justify-center shrink-0 w-5 sm:w-7">
                    <Settings size={18} />
                  </span>
                  <span>Settings</span>
                </li>
              </Link>
            </ul>
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
