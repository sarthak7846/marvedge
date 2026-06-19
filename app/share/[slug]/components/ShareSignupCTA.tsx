import Link from "next/link";

export default function ShareSignupCTA() {
  return (
    <div className="mt-10 text-center">
      <h2 className="text-2xl font-semibold text-[#2E215D]">New to Marvedge?</h2>
      <p className="mx-auto mt-2 max-w-2xl text-sm text-[#7E73AC]">
        Start making your demos today and share polished walkthroughs in minutes.
      </p>
      <div className="mt-5 flex justify-center gap-3">
        <Link
          href="/auth/signup"
          className="rounded-full bg-[#6A56D8] px-6 py-2.5 text-sm font-semibold text-white"
        >
          Sign up
        </Link>
        <Link
          href="/auth/signin"
          className="rounded-full border border-[#CFC2FF] bg-white px-6 py-2.5 text-sm font-semibold text-[#5D4BC5]"
        >
          Login
        </Link>
      </div>
    </div>
  );
}
