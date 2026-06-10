"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Menu, X, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";

const NavButton: React.FC<{
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
}> = ({ children, onClick, className = "" }) => (
  <button
    onClick={onClick}
    className={`text-[#313053] hover:text-[#615fa1] dark:text-gray-300 dark:hover:text-white cursor-pointer text-lg font-semibold transition ${className}`}
  >
    {children}
  </button>
);

const Navbar: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { status } = useSession();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const effectiveTheme = theme === "system" ? resolvedTheme : theme;
  const isDark = mounted && effectiveTheme === "dark";

  const toggleMenu = () => {
    setIsMenuOpen((prev) => !prev);
  };

  const handleLogoClick = () => {
    if (status === "authenticated") {
      router.push("/dashboard");
      return;
    }
    router.push("/");
  };

  return (
    <>
      <nav className="fixed top-0 left-0 w-full z-50 bg-white dark:bg-[#05050d] border-b border-gray-100 dark:border-[rgba(255,255,255,0.08)] min-h-20 flex flex-col justify-start transition-colors duration-300">
        <div className="px-4 sm:px-6 w-full">
          <div className="flex items-center justify-between w-full pt-2">
            <button
              type="button"
              onClick={handleLogoClick}
              className="flex items-center space-x-3 cursor-pointer"
              aria-label="Go to dashboard"
            >
              <Image
                src="/images/Transparent logo.png"
                alt="Marvedge logo"
                width={80}
                height={80}
                className="w-12 h-12 md:w-16 md:h-16 object-contain dark:hidden"
                priority
              />
              <Image
                src="/images/logo_dark.png"
                alt="Marvedge logo dark"
                width={80}
                height={80}
                className="w-12 h-12 md:w-16 md:h-16 object-contain hidden dark:block"
                priority
              />
              <span className="text-[#8C5BFF] dark:text-[#9c7dff] text-xl md:text-2xl font-semibold">
                Marvedge
              </span>
            </button>
            <button
              onClick={toggleMenu}
              className="md:hidden text-[#313053] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#8C5BFF] p-2"
              aria-label={isMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={isMenuOpen}
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {pathname !== "/pricing" && (
          <div className="hidden md:flex items-center space-x-8 text-[#313053] dark:text-white font-medium absolute right-8 top-6">
            <button
              onClick={() => setTheme(isDark ? "light" : "dark")}
              className="relative w-[46px] h-[24px] sm:w-[50px] sm:h-[26px] rounded-full flex items-center justify-between px-1.5 transition-colors duration-300 cursor-pointer border outline-none bg-[#F1ECFF] border-[#bcb3f7] dark:bg-[#151229] dark:border-[rgba(255,255,255,0.08)]"
              aria-label="Toggle theme"
            >
              <Sun
                size={12}
                className="transition-all duration-300 text-amber-500 fill-amber-500/20 dark:text-gray-400 dark:opacity-30 dark:fill-none"
              />
              <Moon
                size={12}
                className="transition-all duration-300 text-gray-400 opacity-30 dark:text-[#a085ff] dark:opacity-100"
              />
              <div
                className={`absolute top-[2px] left-[2px] w-[18px] h-[18px] sm:w-[20px] sm:h-[20px] rounded-full shadow-md transition-all duration-300 flex items-center justify-center ${
                  isDark
                    ? "translate-x-[24px] sm:translate-x-[26px] bg-gradient-to-b from-[#8a63ff] to-[#5c38f7]"
                    : "translate-x-0 bg-white"
                }`}
              >
                {isDark ? (
                  <Moon size={10} className="text-white fill-white/10" />
                ) : (
                  <Sun size={10} className="text-amber-500 fill-amber-500/10" />
                )}
              </div>
            </button>
            <NavButton
              onClick={() => {
                if (window.location.pathname === "/") {
                  document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
                } else {
                  router.push("/#features");
                }
              }}
            >
              Features
            </NavButton>
            <NavButton
              onClick={() => {
                if (window.location.pathname === "/") {
                  document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
                } else {
                  router.push("/#pricing");
                }
              }}
            >
              Pricing
            </NavButton>
            <NavButton
              onClick={() => {
                if (window.location.pathname === "/") {
                  document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth" });
                } else {
                  router.push("/#reviews");
                }
              }}
            >
              Reviews
            </NavButton>
          </div>
        )}

        {isMenuOpen && pathname !== "/pricing" && (
          <div className="md:hidden absolute top-20 left-0 w-full bg-white dark:bg-[#05050d] z-40 flex flex-col items-start p-4 space-y-3 shadow-md border-b dark:border-[rgba(255,255,255,0.08)]">
            <div className="flex items-center justify-between w-full pb-2 border-b border-gray-100 dark:border-[rgba(255,255,255,0.08)] mb-1">
              <span className="text-[#313053] dark:text-gray-300 text-sm font-semibold">
                Switch Theme
              </span>
              <button
                onClick={() => setTheme(isDark ? "light" : "dark")}
                className="relative w-[46px] h-[24px] sm:w-[50px] sm:h-[26px] rounded-full flex items-center justify-between px-1.5 transition-colors duration-300 cursor-pointer border outline-none bg-[#F1ECFF] border-[#bcb3f7] dark:bg-[#151229] dark:border-[rgba(255,255,255,0.08)]"
                aria-label="Toggle theme"
              >
                <Sun
                  size={12}
                  className="transition-all duration-300 text-amber-500 fill-amber-500/20 dark:text-gray-400 dark:opacity-30 dark:fill-none"
                />
                <Moon
                  size={12}
                  className="transition-all duration-300 text-gray-400 opacity-30 dark:text-[#a085ff] dark:opacity-100"
                />
                <div
                  className={`absolute top-[2px] left-[2px] w-[18px] h-[18px] sm:w-[20px] sm:h-[20px] rounded-full shadow-md transition-all duration-300 flex items-center justify-center ${
                    isDark
                      ? "translate-x-[24px] sm:translate-x-[26px] bg-gradient-to-b from-[#8a63ff] to-[#5c38f7]"
                      : "translate-x-0 bg-white"
                  }`}
                >
                  {isDark ? (
                    <Moon size={10} className="text-white fill-white/10" />
                  ) : (
                    <Sun size={10} className="text-amber-500 fill-amber-500/10" />
                  )}
                </div>
              </button>
            </div>
            <NavButton
              onClick={() => {
                if (window.location.pathname === "/") {
                  document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
                } else {
                  router.push("/#features");
                }
                toggleMenu();
              }}
            >
              Features
            </NavButton>
            <NavButton
              onClick={() => {
                if (window.location.pathname === "/") {
                  document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
                } else {
                  router.push("/#pricing");
                }
                toggleMenu();
              }}
            >
              Pricing
            </NavButton>
            <NavButton
              onClick={() => {
                if (window.location.pathname === "/") {
                  document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth" });
                } else {
                  router.push("/#reviews");
                }
                toggleMenu();
              }}
            >
              Reviews
            </NavButton>
          </div>
        )}
      </nav>
    </>
  );
};

export default Navbar;
