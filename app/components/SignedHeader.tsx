import { useSession } from "next-auth/react";
import React, { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useProfileImage } from "./signed-header/useProfileImage";
import HeaderTitleIcon from "./signed-header/HeaderTitleIcon";
import ThemeToggleButton from "./signed-header/ThemeToggleButton";
import UserMenu from "./signed-header/UserMenu";

interface SignedHeaderProps {
  titleText: string;
  iconSRC: string;
  iconALT: string;
  className?: string;
}

const SignedHeader = ({ titleText, iconSRC, iconALT, className }: SignedHeaderProps) => {
  const { data: session } = useSession();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const effectiveTheme = theme === "system" ? resolvedTheme : theme;
  const isDark = mounted && effectiveTheme === "dark";

  const profileImage = useProfileImage(session);

  return (
    <>
      <div
        className={`topbar w-full bg-white border-b border-gray-200 flex items-center justify-between px-3 sm:px-6 md:px-8 py-2.5 sm:py-4 gap-2 ${
          className || ""
        }`}
      >
        <div className="topbar-left page-title flex items-center gap-1 sm:gap-1.5 min-w-0 pl-12 sm:pl-6">
          <HeaderTitleIcon iconSRC={iconSRC} iconALT={iconALT} isDark={isDark} />
          <h2 className="text-sm sm:text-base md:text-lg text-gray-500 dark:text-white font-medium truncate">
            {titleText}
          </h2>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 md:gap-6 min-w-0">
          <ThemeToggleButton isDark={isDark} setTheme={setTheme} />

          <span className="user welcome hidden sm:inline text-gray-500 dark:text-white text-xs md:text-sm lg:text-lg whitespace-nowrap">
            <p className="inline">Welcome</p>{" "}
            <span className="font-semibold text-[#7C5CFC] dark:text-[#7a5cff]">
              {session?.user?.name?.split(" ")[0] || session?.user?.email?.split("@")[0] || "User"}
            </span>{" "}
            <span className="inline-block">👋</span>
          </span>
          <div className="flex items-center gap-1 sm:gap-1.5">
            <UserMenu session={session} isDark={isDark} profileImage={profileImage} />
          </div>
        </div>
      </div>
    </>
  );
};

export default SignedHeader;
