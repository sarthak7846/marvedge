// The lead inbox. Owner-scoped, behind the same server flag as the funnel.
//
// A server component that renders nothing but the gate: everything below it is
// fetched client-side from /api/leads, which is where the ownership scoping
// lives. This page holds no lead data of its own, so a lead field cannot end up
// in the RSC payload of a page that might later be cached.

import { getPageMetadata } from "@/app/lib/metadata";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/lib/auth/options";
import { isOverlaysEnabled } from "@/app/lib/overlays/flags";
import LeadsClient from "./LeadsClient";

export const metadata = getPageMetadata("leads");

export default async function Page() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return null;
  }

  if (!isOverlaysEnabled()) {
    return (
      <div className="flex h-full min-h-0 grow flex-col items-center justify-center bg-[#F4F1FD] p-6 text-center text-[#2D2154]">
        <p className="text-lg font-semibold text-[rgba(38,23,83,0.66)]">Leads are not enabled</p>
        <p className="mt-1 max-w-md text-sm text-[rgba(38,23,83,0.51)]">
          The interactive overlays feature is switched off on this deployment, so no leads are being
          captured.
        </p>
      </div>
    );
  }

  return <LeadsClient />;
}
