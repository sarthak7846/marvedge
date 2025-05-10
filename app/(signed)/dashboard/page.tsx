"use client";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";

const DashboardPage = () => {
  const { data: session } = useSession();

  return (
    <div>
      Signed in as {session?.user?.email}
      <button onClick={() => signOut()}>Sign out</button>
      <div>
        <Link href={"/recorder"}>Go to Recorder</Link>
      </div>
    </div>
  );
};

export default DashboardPage;
