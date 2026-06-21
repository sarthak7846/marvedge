import React from "react";
import { Sun, Moon } from "lucide-react";

interface ThemeToggleButtonProps {
  isDark: boolean;
  setTheme: (theme: string) => void;
}

const ThemeToggleButton = ({ isDark, setTheme }: ThemeToggleButtonProps) => (
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
);

export default ThemeToggleButton;
