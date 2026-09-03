import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Inbox, Settings, Share2 } from "lucide-react";

import { isOverlaysPanelEnabled } from "@/app/lib/overlays/flags";

interface SidebarNavProps {
  isDark: boolean;
  pathname: string | null;
  onNavigate: () => void;
}

const SidebarNav = ({ isDark, pathname, onNavigate }: SidebarNavProps) => {
  const activeClass = isDark
    ? "menu-item active font-light rounded-lg h-8 sm:h-10 px-1 sm:px-2"
    : "bg-[#bcb3f7] border border-transparent text-white font-light rounded-lg shadow-sm h-8 sm:h-10 px-1 sm:px-2";

  const inactiveClass = isDark
    ? "menu-item font-light rounded-lg h-8 sm:h-10 px-1 sm:px-2"
    : "text-white border border-transparent font-light hover:bg-[#bcb3f7] rounded-lg h-8 sm:h-10 px-1 sm:px-2";

  const items = [
    {
      href: "/dashboard",
      label: "Dashboard",
      icon: (
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
      ),
    },
    {
      href: "/demos",
      label: "My Demos",
      icon: (
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
      ),
    },
    {
      href: "/exported-videos",
      label: "Shared Videos",
      icon: <Share2 size={18} />,
    },
    {
      href: "/analytics",
      label: "Analytics",
      icon: (
        <Image
          src="/icons/dash-analytics.svg"
          alt="Analytics"
          width={18}
          height={18}
          className={`object-contain w-5 h-5 sm:w-5 sm:h-5 ${isDark ? "brightness-0 invert" : ""}`}
        />
      ),
    },
    // The lead inbox. Behind the client overlays flag: with the feature off
    // there are no leads to read, and a nav item advertising a switched-off
    // feature is worse than no nav item. NEXT_PUBLIC_ is inlined at build time,
    // so this costs nothing at runtime and leaks no secret.
    ...(isOverlaysPanelEnabled()
      ? [
          {
            href: "/leads",
            label: "Leads",
            icon: <Inbox size={18} />,
          },
        ]
      : []),
    {
      href: "/settings",
      label: "Settings",
      icon: <Settings size={18} />,
    },
  ];

  return (
    <ul className="space-y-1 sm:space-y-2 text-sm sm:text-lg font-medium">
      {items.map((item) => (
        <Link key={item.href} href={item.href} onClick={onNavigate}>
          <li
            className={`flex items-center justify-start gap-1 sm:gap-4 transition-colors cursor-pointer text-xs sm:text-base ${
              pathname === item.href ? activeClass : inactiveClass
            }`}
          >
            <span className="flex items-center justify-center shrink-0 w-5 sm:w-7">
              {item.icon}
            </span>
            <span>{item.label}</span>
          </li>
        </Link>
      ))}
    </ul>
  );
};

export default SidebarNav;
