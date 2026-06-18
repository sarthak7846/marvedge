"use client";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { useSignUp } from "./useSignUp";
import SignUpMobileNav from "./SignUpMobileNav";
import SignUpIllustration from "./SignUpIllustration";

const SignUp = () => {
  const {
    showPassword,
    togglePassword,
    showConfirmPassword,
    toggleConfirm,
    isLoading,
    animatePanel,
    email,
    setEmail,
    name,
    setName,
    passwordRef,
    confirmPasswordRef,
    router,
    handleSignUp,
  } = useSignUp();

  return (
    <div className="flex flex-col md:flex-row h-full min-h-screen font-sans bg-[#F1ECFF]">
      <SignUpMobileNav />

      <SignUpIllustration animatePanel={animatePanel} />

      <div
        className={`w-full md:w-1/2 flex justify-center items-center px-4 sm:px-10 lg:px-20 py-10 transition-all duration-700 ease-out pt-24 md:pt-10 ${
          animatePanel ? "opacity-100 translate-x-0" : "opacity-0 translate-x-10"
        }`}
      >
        <form
          onSubmit={handleSignUp}
          className="w-full max-w-md space-y-5 sm:space-y-6"
          autoComplete="on"
        >
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-black mb-2">Create your Account</h1>
            <p className="text-sm text-gray-600 font-semibold">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => router.push("/auth/signin")}
                className="text-[#6356D7] hover:underline font-semibold cursor-pointer"
              >
                Sign In here.
              </button>
            </p>
          </div>
          <input
            type="text"
            name="name"
            autoComplete="name"
            placeholder="Your First Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full p-3 border-2 border-gray-500 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#6A4EFF] transition-all duration-300 focus:scale-[1.02] hover:border-[#B8AAFF]"
          />

          <input
            type="email"
            name="email"
            autoComplete="email"
            placeholder="Your Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full p-3 border-2 border-gray-500 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#6A4EFF] transition-all duration-300 focus:scale-[1.02] hover:border-[#B8AAFF]"
          />

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              name="new-password"
              autoComplete="new-password"
              placeholder="Enter Password"
              ref={passwordRef}
              required
              className="w-full p-3 border-2 border-gray-500 rounded-md text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-[#6A4EFF] transition-all duration-300 focus:scale-[1.02] hover:border-[#B8AAFF]"
            />
            <button
              type="button"
              onClick={togglePassword}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 cursor-pointer"
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
              placeholder="Enter Confirm Password"
              ref={confirmPasswordRef}
              required
              className="w-full p-3 border-2 border-gray-500 rounded-md text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-[#6A4EFF] transition-all duration-300 focus:scale-[1.02] hover:border-[#B8AAFF]"
            />
            <button
              type="button"
              onClick={toggleConfirm}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 cursor-pointer"
            >
              <Image
                src={showConfirmPassword ? "/icons/eyeclosed.png" : "/icons/eyeopen.png"}
                alt="Toggle Confirm"
                width={20}
                height={20}
              />
            </button>
          </div>
          <label className="flex items-center space-x-2 text-sm">
            <input type="checkbox" className="accent-[#6356D7]" />
            <span className="font-semibold cursor-pointer">Remember Me</span>
          </label>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-[#6356D7] text-white rounded-md hover:bg-[#7E5FFF] font-semibold transition-all text-sm shadow-md cursor-pointer"
          >
            {isLoading ? "Creating Account..." : "Sign Up"}
          </button>

          <div className="flex items-center gap-4 text-sm text-gray-500">
            <div className="flex-grow border-t" />
            <span className="font-semibold">or sign up with</span>
            <div className="flex-grow border-t" />
          </div>

          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => signIn("google")}
              className="h-[45px] w-[120px] rounded-md border border-[#D5C9FF] bg-[#F1ECFF] shadow-md hover:shadow-lg transition-all duration-300 active:scale-95 hover:scale-105 flex items-center justify-center cursor-pointer"
              title="Sign up with Google"
            >
              <Image src="/icons/google.png" alt="Google" width={25} height={25} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SignUp;
