"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import AuthPulseDots from "@/app/components/AuthPulseDots";

type SignUpIllustrationProps = {
  animatePanel: boolean;
};

const SignUpIllustration = ({ animatePanel }: SignUpIllustrationProps) => {
  const router = useRouter();

  return (
    <div className="hidden md:flex md:w-1/2 relative justify-center items-center overflow-hidden rounded-r-[75px] bg-[#B09EE4] dark:bg-[#6d42ff]">
      <div
        className={`absolute inset-0 bg-[#261753] dark:bg-gradient-to-b dark:from-[#0a061d] dark:to-[#080513] rounded-r-[75px] z-0 transition-all duration-700 ease-out ${
          animatePanel ? "mr-[20px]" : "mr-[100%]"
        }`}
      />
      <div className="relative z-10 px-6 sm:px-8">
        <Image
          src="/icons/sign-up-Vector.svg"
          alt="Signup Illustration"
          width={400}
          height={400}
          className="max-w-full h-auto"
        />
      </div>
      <button
        onClick={() => router.push("/")}
        className="absolute top-4 sm:top-6 left-6 sm:left-10 flex items-center gap-2 sm:gap-3 z-10 cursor-pointer"
      >
        <Image src="/icons/logo.png" alt="Logo" width={28} height={28} />
        <span className="text-base sm:text-lg font-extrabold tracking-wider text-[#B09EE4] dark:text-white">
          MARVEDGE
        </span>
      </button>

      <AuthPulseDots />
    </div>
  );
};

export default SignUpIllustration;
