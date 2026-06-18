"use client";
import Image from "next/image";
import AuthPulseDots from "@/app/components/AuthPulseDots";

type ResetPasswordIllustrationProps = {
  animatePanel: boolean;
};

const ResetPasswordIllustration = ({ animatePanel }: ResetPasswordIllustrationProps) => {
  return (
    <div className="hidden md:flex md:w-1/2 relative justify-center items-center overflow-hidden rounded-r-[75px] bg-[#B09EE4]">
      <div
        className={`absolute inset-0 bg-[#261753] rounded-r-[75px] z-0 transition-all duration-700 ease-out ${
          animatePanel ? "mr-[20px]" : "mr-[100%]"
        }`}
      />
      <div className="relative z-10 px-6 sm:px-8">
        <Image
          src="/icons/sign-up-Vector.svg"
          alt="Reset Illustration"
          width={400}
          height={400}
          className="max-w-full h-auto"
        />
      </div>
      <div className="absolute top-4 sm:top-6 left-6 sm:left-10 flex items-center gap-2 sm:gap-3 z-10">
        <Image src="/icons/logo.png" alt="Logo" width={28} height={28} />
        <span className="text-base sm:text-lg font-extrabold tracking-wider text-[#B09EE4]">
          MARVEDGE
        </span>
      </div>
      {/* Pulse elements */}
      <AuthPulseDots />
    </div>
  );
};

export default ResetPasswordIllustration;
