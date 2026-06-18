"use client";
import { useRouter } from "next/navigation";

const ResetPasswordMobileNav = () => {
  const router = useRouter();

  return (
    <div
      className="md:hidden absolute top-0 left-0 w-full h-20 bg-gradient-to-b from-[#313053] to-[#261753] z-[1000] flex justify-center items-center shadow-lg"
      style={{
        borderBottomLeftRadius: "50% 20%",
        borderBottomRightRadius: "50% 20%",
      }}
    >
      <div className="flex bg-[#313053]/80 backdrop-blur-sm rounded-full p-1.5 shadow-inner">
        <button
          onClick={() => router.push("/auth/signin")}
          className="px-6 py-2 rounded-full transition-all duration-300 transform hover:scale-105 bg-gradient-to-r from-[#615fa1] to-[#313053] text-white shadow-md"
        >
          Sign In
        </button>
      </div>
    </div>
  );
};

export default ResetPasswordMobileNav;
