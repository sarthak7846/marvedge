import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth/options";
import { prisma } from "@/app/lib/prisma";
import { getCustomDomainStatus } from "@/app/lib/cloudflare";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (!session.user?.id && !session.user?.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ id: session.user.id || undefined }, { email: session.user.email || undefined }],
      },
      include: { hubSettings: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const settings = user.hubSettings;
    if (!settings || !settings.cloudflareId || !settings.customDomain) {
      return NextResponse.json({
        success: true,
        message: "No custom domain to verify",
        settings,
      });
    }

    // Call Cloudflare to fetch latest status
    const cfStatus = await getCustomDomainStatus(settings.cloudflareId, settings.customDomain);

    if (cfStatus.success) {
      const updatedSettings = await prisma.hubSettings.update({
        where: { id: settings.id },
        data: {
          sslStatus: cfStatus.sslStatus || settings.sslStatus,
          dnsVerification: cfStatus.dnsVerification
            ? JSON.parse(JSON.stringify(cfStatus.dnsVerification))
            : settings.dnsVerification,
        },
      });

      return NextResponse.json({
        success: true,
        sslStatus: updatedSettings.sslStatus,
        dnsVerification: updatedSettings.dnsVerification,
        settings: updatedSettings,
      });
    } else {
      console.error("Cloudflare domain verification polling failed:", cfStatus.error);
      return NextResponse.json({
        success: false,
        error: cfStatus.error || "Failed to retrieve status from Cloudflare",
        settings,
      });
    }
  } catch (error) {
    console.error("POST /api/hub/verify error:", error);
    return NextResponse.json({ error: "Failed to verify custom domain status" }, { status: 500 });
  }
}
