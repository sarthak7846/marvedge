import Image from "next/image";
import Link from "next/link";

type ShareHeaderProps = {
  isLoggedIn: boolean;
};

export default function ShareHeader({ isLoggedIn }: ShareHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-[#E5DCFF] bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 text-[#6B5ED8]">
          <Image src="/icons/logo.png" alt="Marvedge logo" width={28} height={28} />
          <span className="text-sm font-bold uppercase tracking-[0.18em]">Marvedge</span>
        </Link>
        {!isLoggedIn && (
          <div className="flex items-center gap-3">
            <Link
              href="/auth/signin"
              className="rounded-full border border-[#D4CAFF] px-4 py-2 text-sm font-medium text-[#6F5FBC]"
            >
              Login
            </Link>
            <Link
              href="/auth/signup"
              className="rounded-full bg-[#6E5AD8] px-4 py-2 text-sm font-semibold text-white"
            >
              Sign up
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
