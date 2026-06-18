"use client";
import { Suspense } from "react";
import Image from "next/image";
import { useResetPassword } from "./useResetPassword";
import ResetPasswordMobileNav from "./ResetPasswordMobileNav";
import ResetPasswordIllustration from "./ResetPasswordIllustration";

const ResetPassword = () => {
  const {
    showPassword,
    togglePassword,
    showConfirmPassword,
    toggleConfirm,
    isLoading,
    animatePanel,
    emailRef,
    passwordRef,
    confirmPasswordRef,
    handleReset,
  } = useResetPassword();

  return (
    <div className="flex flex-col md:flex-row h-full min-h-screen font-sans bg-[#F1ECFF]">
      <ResetPasswordMobileNav />
      <ResetPasswordIllustration animatePanel={animatePanel} />
      <div
        className={`w-full md:w-1/2 flex justify-center items-center px-4 sm:px-10 lg:px-20 py-10 transition-all duration-700 ease-out pt-24 md:pt-10 ${
          animatePanel ? "opacity-100 translate-x-0" : "opacity-0 translate-x-10"
        }`}
      >
        <form
          onSubmit={handleReset}
          className="w-full max-w-md space-y-5 sm:space-y-6"
          autoComplete="on"
        >
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-black mb-2">Reset Password</h1>
            <p className="text-sm text-gray-600 font-semibold">
              Enter your new password to reset your account.
            </p>
          </div>
          <input
            type="email"
            name="email"
            autoComplete="email"
            placeholder="Your Email"
            ref={emailRef}
            required
            className="w-full p-3 border-2 border-gray-500 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#6A4EFF] transition-all duration-300 focus:scale-[1.02] hover:border-[#B8AAFF]"
          />
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              name="new-password"
              autoComplete="new-password"
              placeholder="Enter New Password"
              ref={passwordRef}
              required
              className="w-full p-3 border-2 border-gray-500 rounded-md text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-[#6A4EFF] transition-all duration-300 focus:scale-[1.02] hover:border-[#B8AAFF]"
            />
            <button
              type="button"
              onClick={togglePassword}
              className="absolute right-3 top-1/2 transform -translate-y-1/2"
            >
              <Image
                src={showPassword ? "/icons/eyeclosed.png" : "/icons/eyeopen.png"}
                alt="Toggle Password"
                width={20}
                height={20}
              />
            </button>
          </div>
          <div className="relative">
            <input
              type={showConfirmPassword ? "text" : "password"}
              name="confirm-password"
              autoComplete="new-password"
              placeholder="Confirm New Password"
              ref={confirmPasswordRef}
              required
              className="w-full p-3 border-2 border-gray-500 rounded-md text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-[#6A4EFF] transition-all duration-300 focus:scale-[1.02] hover:border-[#B8AAFF]"
            />
            <button
              type="button"
              onClick={toggleConfirm}
              className="absolute right-3 top-1/2 transform -translate-y-1/2"
            >
              <Image
                src={showConfirmPassword ? "/icons/eyeclosed.png" : "/icons/eyeopen.png"}
                alt="Toggle Confirm"
                width={20}
                height={20}
              />
            </button>
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-[#6356D7] text-white rounded-md hover:bg-[#7E5FFF] font-semibold transition-all text-sm shadow-md"
          >
            {isLoading ? "Resetting..." : "Reset Password"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ResetPassword />
    </Suspense>
  );
}
