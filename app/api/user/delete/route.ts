import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth/options";
import { prisma } from "@/app/lib/prisma";

export async function DELETE() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Retrieve user and their hub settings for Cloudflare cleanup
    const userWithHubSettings = await prisma.user.findFirst({
      where: { email: session.user.email },
      include: { hubSettings: true },
    });

    // PRD §4.4: a deleted account must not leave a custom hostname routing to us.
    // A Cloudflare failure must not trap the user in an account they asked to
    // delete, so log the orphan loudly instead — the /api/cron/hub-domains sweep
    // reconciles the zone against our records and reports anything left behind.
    if (userWithHubSettings?.hubSettings?.cloudflareId) {
      const { cloudflareId, customDomain } = userWithHubSettings.hubSettings;
      try {
        const { deleteCustomDomain } = await import("@/app/lib/cloudflare");
        const removal = await deleteCustomDomain(cloudflareId);
        if (!removal.success) {
          console.error(
            `[account-delete] ORPHANED Cloudflare hostname ${customDomain} (${cloudflareId}) still routes to us: ${removal.error}`
          );
        }
      } catch (cfError) {
        console.error(
          `[account-delete] ORPHANED Cloudflare hostname ${customDomain} (${cloudflareId}) still routes to us:`,
          cfError
        );
      }
    }

    // Delete sessions
    await prisma.session.deleteMany({
      where: { user: { email: session.user.email } },
    });

    // Delete accounts
    await prisma.account.deleteMany({
      where: { user: { email: session.user.email } },
    });

    // Delete user
    await prisma.user.delete({
      where: { email: session.user.email },
    });

    return NextResponse.json({ message: "Account deleted successfully" });
  } catch (error) {
    console.error("Error deleting account:", error);
    return NextResponse.json({ error: error || "Failed to delete account" }, { status: 500 });
  }
}
