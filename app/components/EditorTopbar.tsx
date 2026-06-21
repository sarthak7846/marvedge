import { useSession } from "next-auth/react";
import { useRef, useState, useEffect } from "react";
import Image from "next/image";
import { FaBars, FaXmark } from "react-icons/fa6";
import { useRouter } from "next/navigation";
import SidemenuDashboard from "./SidemenuDashboard";
import EditorTopbarUserMenu from "./EditorTopbarUserMenu";
import { useProfileImage } from "./useProfileImage";

type EditorTopbarProps = {
  onBack: () => void;
  userInitials: string;
  onToggleMenu: () => void;
};

const EditorTopbar = ({ onBack, userInitials, onToggleMenu }: EditorTopbarProps) => {
  const router = useRouter();
  const { data: session } = useSession();
  const [showDropdown, setShowDropdown] = useState(false);
  const [isDashboardMenuOpen, setIsDashboardMenuOpen] = useState(false);
  const profileImage = useProfileImage(session);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLDivElement>(null);

  const username =
    session?.user?.name?.split(" ")[0] || session?.user?.email?.split("@")?.[0] || "User";

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
      if (hamburgerRef.current && !hamburgerRef.current.contains(event.target as Node)) {
        setIsDashboardMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Toggle menu on hamburger click
  const handleHamburgerClick = () => {
    setIsDashboardMenuOpen((prev) => !prev);
    onToggleMenu(); // Keep this for mobile compatibility if needed
  };

  return (
    <div className="w-full flex items-center justify-between px-4 sm:px-8 py-2 sm:py-4 bg-white border-b border-[#ede7fa] shadow-sm">
      <div className="flex items-center gap-2 sm:gap-6">
        <button
          onClick={onBack}
          className="text-[#7C5CFC] text-xl sm:text-2xl hover:bg-[#ede7fa] rounded-full p-1 mr-2 sm:mr-4 order-1"
          style={{ order: 1 }}
        >
          <Image
            src="/icons/arrow_left_icon.png"
            alt="Back"
            width={20}
            height={20}
            className="md:w-6 md:h-6"
          />
        </button>
        <div className="relative" ref={hamburgerRef}>
          <button
            className="flex items-center gap-2 px-4 sm:px-6 h-10 sm:h-12 rounded-lg bg-[#A594F9] text-white font-semibold shadow-sm hover:bg-[#7C5CFC] focus:ring-2 focus:ring-[#A594F9] transition-all text-base max-w-xs min-w-fit whitespace-nowrap"
            onClick={handleHamburgerClick}
            aria-label="Toggle dashboard menu"
          >
            <FaBars className="text-xl" />
          </button>
          {isDashboardMenuOpen && (
            <div className="absolute top-12 left-0 w-64 bg-white shadow-lg p-4 border border-gray-200 rounded-lg z-50 sidebar-hover-menu">
              <button
                onClick={() => setIsDashboardMenuOpen(false)}
                className="absolute top-2 right-2 text-[#7C5CFC] hover:text-[#6356D7] text-xl"
                aria-label="Close menu"
              >
                <FaXmark />
              </button>
              <SidemenuDashboard />
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="ml-2 sm:ml-0 text-lg sm:text-2xl font-extrabold text-[#7C5CFC] tracking-widest flex items-center gap-2 order-3 cursor-pointer hover:opacity-90 transition-opacity"
          aria-label="Go to dashboard"
        >
          <Image
            src="/images/Transparent logo.png"
            alt="Marvedge logo"
            width={32}
            height={32}
            className="h-6 w-6 sm:h-8 sm:w-8 object-contain"
            priority
          />
          MARVEDGE
        </button>
      </div>
      <EditorTopbarUserMenu
        username={username}
        session={session}
        userInitials={userInitials}
        profileImage={profileImage}
        showDropdown={showDropdown}
        setShowDropdown={setShowDropdown}
        dropdownRef={dropdownRef}
      />
    </div>
  );
};

export default EditorTopbar;
