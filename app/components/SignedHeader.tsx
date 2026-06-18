import { useSession, signOut } from "next-auth/react";
import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

interface SignedHeaderProps {
  titleText: string;
  iconSRC: string;
  iconALT: string;
  className?: string;
}

const SignedHeader = ({ titleText, iconSRC, iconALT, className }: SignedHeaderProps) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null | undefined>(null);
  const { data: session } = useSession();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const effectiveTheme = theme === "system" ? resolvedTheme : theme;
  const isDark = mounted && effectiveTheme === "dark";

  useEffect(() => {
    const fetchUserImage = async () => {
      try {
        const res = await fetch("/api/user/get", {
          credentials: "include",
        });
        if (!res.ok) {
          setProfileImage(null);
          return;
        }
        const data = await res.json();
        if (data.user?.image && data.user.image.trim()) {
          setProfileImage(data.user.image + `?t=${Date.now()}`);
        } else {
          setProfileImage(null);
        }
      } catch {
        setProfileImage(null);
      }
    };

    if (session?.user) {
      fetchUserImage();
    }
  }, [session]);

  useEffect(() => {
    const handlePhotoUpdate = () => {
      const fetchUserImage = async () => {
        try {
          const res = await fetch("/api/user/get", {
            credentials: "include",
          });
          if (!res.ok) {
            setProfileImage(null);
            return;
          }
          const data = await res.json();
          if (data.user?.image && data.user.image.trim()) {
            setProfileImage(data.user.image + `?t=${Date.now()}`);
          } else {
            setProfileImage(null);
          }
        } catch {
          setProfileImage(null);
        }
      };
      fetchUserImage();
    };

    window.addEventListener("photoUpdated", handlePhotoUpdate);
    return () => window.removeEventListener("photoUpdated", handlePhotoUpdate);
  }, []);

  const initials = React.useMemo(() => {
    const base = session?.user?.name || session?.user?.email?.split("@")[0] || "User";
    return base
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase())
      .join("")
      .slice(0, 2);
  }, [session?.user?.name, session?.user?.email]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      <div
        className={`topbar w-full bg-white border-b border-gray-200 flex items-center justify-between px-3 sm:px-6 md:px-8 py-2.5 sm:py-4 gap-2 ${
          className || ""
        }`}
      >
        <div className="topbar-left page-title flex items-center gap-1 sm:gap-1.5 min-w-0 pl-12 sm:pl-6">
          {iconSRC && (
            <i className="mr-0 sm:mr-1 flex items-center justify-center shrink-0">
              {isDark ? (
                iconSRC.includes("Vector") ||
                iconSRC.includes("team_icon") ||
                iconSRC.includes("dash-home") ||
                iconSRC.includes("home") ? (
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 34 34"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-5 h-5 sm:w-6 sm:h-6 object-contain"
                  >
                    <path
                      d="M7.08203 26.9178V14.6041C7.08203 14.2415 7.16325 13.8982 7.3257 13.5742C7.48814 13.2503 7.71198 12.9835 7.9972 12.7738L15.6259 6.99665C16.0254 6.69159 16.4816 6.53906 16.9944 6.53906C17.5073 6.53906 17.9663 6.69159 18.3714 6.99665L26.0002 12.7724C26.2864 12.9821 26.5102 13.2493 26.6717 13.5742C26.8341 13.8982 26.9154 14.6041 26.9154 14.6041V26.9178C26.9154 27.2975 26.7742 27.6285 26.4918 27.9109C26.2094 28.1933 25.8784 28.3345 25.4987 28.3345H20.7047C20.3798 28.3345 20.1078 28.2249 19.8887 28.0058C19.6696 27.7858 19.56 27.5138 19.56 27.1898V20.4337C19.56 20.1098 19.4505 19.8383 19.2314 19.6191C19.0113 19.3991 18.7393 19.2891 18.4154 19.2891H15.582C15.2581 19.2891 14.9866 19.3991 14.7674 19.6191C14.5474 19.8383 14.4374 20.1098 14.4374 20.4337V27.1912C14.4374 27.5152 14.3278 27.7867 14.1087 28.0058C13.8896 28.2249 13.6181 28.3345 13.2941 28.3345H8.4987C8.11903 28.3345 7.788 28.1933 7.50561 27.9109C7.22323 27.6285 7.08203 27.2975 7.08203 26.9178Z"
                      fill="currentColor"
                    />
                  </svg>
                ) : iconSRC.includes("Group") ||
                  iconSRC.includes("dash-play") ||
                  iconSRC.includes("play") ? (
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 31 31"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-5 h-5 sm:w-6 sm:h-6 object-contain"
                  >
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M7.324 6.14715C7.35888 5.85387 7.4617 5.57276 7.62429 5.32619C7.78687 5.07961 8.00474 4.87437 8.26057 4.72676C8.51639 4.57916 8.80312 4.49328 9.09797 4.47593C9.39281 4.45859 9.68763 4.51027 9.959 4.62686C11.3308 5.21328 14.4049 6.60699 18.3058 8.85836C22.2079 11.111 24.9527 13.0782 26.1449 13.9708C27.1627 14.7342 27.1653 16.248 26.1462 17.0139C24.9656 17.9013 22.2544 19.8427 18.3058 22.1238C14.3533 24.4049 11.3153 25.7818 9.95642 26.3604C8.78617 26.8603 7.47642 26.1021 7.324 24.8402C7.14575 23.3651 6.8125 20.0158 6.8125 15.4924C6.8125 10.9715 7.14446 7.62353 7.324 6.14715Z"
                      fill="currentColor"
                    />
                  </svg>
                ) : iconSRC.includes("analytics") ||
                  iconSRC.includes("dash-grow") ||
                  iconSRC.includes("grow") ? (
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 36 36"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-5 h-5 sm:w-6 sm:h-6 object-contain"
                  >
                    <path
                      d="M32.8809 9.93C32.7287 9.56348 32.4374 9.27221 32.0709 9.12C31.8906 9.04314 31.6969 9.00237 31.5009 9H24.0009C23.6031 9 23.2215 9.15804 22.9402 9.43934C22.6589 9.72064 22.5009 10.1022 22.5009 10.5C22.5009 10.8978 22.6589 11.2794 22.9402 11.5607C23.2215 11.842 23.6031 12 24.0009 12H27.8859L19.5009 20.385L14.5659 15.435C14.4264 15.2944 14.2605 15.1828 14.0778 15.1067C13.895 15.0305 13.6989 14.9913 13.5009 14.9913C13.3029 14.9913 13.1068 15.0305 12.924 15.1067C12.7412 15.1828 12.5753 15.2944 12.4359 15.435L3.43588 24.435C3.29529 24.5744 3.1837 24.7403 3.10755 24.9231C3.03139 25.1059 2.99219 25.302 2.99219 25.5C2.99219 25.698 3.03139 25.8941 3.10755 26.0769C3.1837 26.2597 3.29529 26.4256 3.43588 26.565C3.57533 26.7056 3.74123 26.8172 3.92402 26.8933C4.10681 26.9695 4.30287 27.0087 4.50089 27.0087C4.6989 27.0087 4.89496 26.9695 5.07775 26.8933C5.26054 26.8172 5.42644 26.7056 5.56589 26.565L13.5009 18.615L18.4359 23.565C18.5753 23.7056 18.7412 23.8172 18.924 23.8933C19.1068 23.9695 19.3029 24.0087 19.5009 24.0087C19.6989 24.0087 19.895 23.9695 20.0778 23.8933C20.2605 23.8172 20.4264 23.7056 20.5659 23.565L30.0009 14.115V18C30.0009 18.3978 30.1589 18.7794 30.4402 19.0607C30.7215 19.342 31.1031 19.5 31.5009 19.5C31.8987 19.5 32.2802 19.342 32.5615 19.0607C32.8429 18.7794 33.0009 18.3978 33.0009 18V10.5C32.9985 10.304 32.9577 10.1103 32.8809 9.93Z"
                      fill="currentColor"
                    />
                  </svg>
                ) : iconSRC.includes("setting") ? (
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-5 h-5 sm:w-6 sm:h-6 object-contain"
                  >
                    <path
                      d="M19.14 12.94C19.18 12.63 19.2 12.32 19.2 12C19.2 11.68 19.18 11.37 19.14 11.06L21.4 9.3C21.6 9.14 21.66 8.87 21.53 8.66L19.4 4.97C19.27 4.76 19 4.68 18.78 4.76L16.12 5.83C15.57 5.41 14.96 5.07 14.3 4.8L13.9 1.97C13.86 1.74 13.66 1.58 13.43 1.58H9.17C8.94 1.58 8.74 1.74 8.7 1.97L8.3 4.8C7.64 5.07 7.03 5.41 6.48 5.83L3.82 4.76C3.6 4.68 3.33 4.76 3.2 4.97L1.07 8.66C0.94 8.87 1 9.14 1.2 9.3L3.46 11.06C3.42 11.37 3.4 11.68 3.4 12C3.4 12.32 3.42 12.63 3.46 12.94L1.2 14.7C1 14.86 0.94 15.13 1.07 15.34L3.2 19.03C3.33 19.24 3.6 19.32 3.82 19.24L6.48 18.17C7.03 18.59 7.64 18.93 8.3 19.2L8.7 22.03C8.74 22.26 8.94 22.42 9.17 22.42H13.43C13.66 22.42 13.86 22.26 13.9 22.03L14.3 19.2C14.96 18.93 15.57 18.59 16.12 18.17L18.78 19.24C19 19.32 19.27 19.24 19.4 19.03L21.53 15.34C21.66 15.13 21.6 14.86 21.4 14.7L19.14 12.94ZM12 15.6C10.01 15.6 8.4 13.99 8.4 12C8.4 10.01 10.01 8.4 12 8.4C13.99 8.4 15.6 10.01 15.6 12C15.6 13.99 13.99 15.6 12 15.6Z"
                      fill="currentColor"
                    />
                  </svg>
                ) : iconSRC.includes("dashboard") ? (
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-5 h-5 sm:w-6 sm:h-6 object-contain"
                  >
                    <path
                      d="M4 4H10V12H4V4ZM4 14H10V20H4V14ZM12 4H20V10H12V4ZM12 12H20V20H12V12Z"
                      fill="currentColor"
                    />
                  </svg>
                ) : (
                  <Image
                    src={iconSRC}
                    alt={iconALT}
                    width={24}
                    height={24}
                    className="w-5 h-5 sm:w-6 sm:h-6 object-contain"
                    style={{ filter: "brightness(0) invert(1)" }}
                    unoptimized
                  />
                )
              ) : (
                <Image
                  src={iconSRC}
                  alt={iconALT}
                  width={24}
                  height={24}
                  className="w-5 h-5 sm:w-6 sm:h-6 object-contain"
                  style={{
                    filter: "invert(0.35) sepia(0.5) saturate(2) hue-rotate(240deg)",
                  }}
                  unoptimized
                />
              )}
            </i>
          )}
          <h2 className="text-sm sm:text-base md:text-lg text-gray-500 dark:text-white font-medium truncate">
            {titleText}
          </h2>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 md:gap-6 min-w-0">
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

          <span className="user welcome hidden sm:inline text-gray-500 dark:text-white text-xs md:text-sm lg:text-lg whitespace-nowrap">
            <p className="inline">Welcome</p>{" "}
            <span className="font-semibold text-[#7C5CFC] dark:text-[#7a5cff]">
              {session?.user?.name?.split(" ")[0] || session?.user?.email?.split("@")[0] || "User"}
            </span>{" "}
            <span className="inline-block">👋</span>
          </span>
          <div className="flex items-center gap-1 sm:gap-1.5">
            <div className="relative" ref={dropdownRef}>
              <button
                className={`avatar user-avatar w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-lg font-bold shadow cursor-pointer hover:scale-105 transition-all overflow-hidden ${
                  isDark ? "border-none" : "border-2 sm:border-4 border-white"
                }`}
                onClick={() => setShowDropdown((v) => !v)}
                title={session?.user?.name || session?.user?.email || undefined}
                style={
                  isDark
                    ? { backgroundColor: "#5b3df5", color: "white" }
                    : profileImage
                      ? {}
                      : { backgroundColor: "#7C5CFC", color: "white" }
                }
              >
                {!isDark && profileImage ? (
                  <Image
                    key={profileImage}
                    src={profileImage}
                    alt="Profile"
                    width={40}
                    height={40}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                ) : (
                  initials
                )}
              </button>
              {showDropdown && (
                <div className="absolute right-0 mt-2 w-48 sm:w-56 bg-white dark:bg-[#070611] rounded-lg shadow-lg p-2 sm:p-3 z-50 border border-gray-200 dark:border-[rgba(255,255,255,0.08)] animate-fade-in">
                  <div className="mb-1 sm:mb-2 text-sm sm:text-base font-bold text-[#6356D7] dark:text-[#7c69ff] truncate">
                    {session?.user?.name || "User"}
                  </div>
                  <div className="mb-1 text-gray-700 dark:text-gray-300 text-xs font-semibold truncate">
                    {session?.user?.email}
                  </div>
                  <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="mt-2 sm:mt-3 w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-[#6356D7] text-white rounded hover:bg-[#7E5FFF] font-semibold transition-all text-xs sm:text-sm"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SignedHeader;
