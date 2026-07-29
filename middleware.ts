import { NextRequest, NextResponse, NextFetchEvent } from "next/server";
import { withAuth } from "next-auth/middleware";
import { classifyHost, mainAppOrigin } from "@/app/lib/hubDomain";
import { isBdhRoutingEnabled } from "@/app/lib/bdh/flags";

const authMiddleware = withAuth({
  pages: {
    signIn: "/auth/signin",
  },
});

export default async function middleware(req: NextRequest, event: NextFetchEvent) {
  const hostname = req.headers.get("host") || "";
  const url = req.nextUrl.clone();

  // 1. Exclude system paths and APIs
  if (
    url.pathname.startsWith("/_next") ||
    url.pathname.startsWith("/api") ||
    url.pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // 2. Subdomain & custom domain routing. Anything that is not the app's own
  // domain (or a dev/preview host) is treated as a customer hub.
  const { kind, domainKey } = classifyHost(hostname);

  // Kill switch: with hub routing off, every host serves the normal app.
  if (kind !== "main" && isBdhRoutingEnabled()) {
    // Send app-only routes back to the main domain rather than 404ing them
    // inside a hub.
    if (url.pathname.startsWith("/dashboard") || url.pathname.startsWith("/auth")) {
      return NextResponse.redirect(`${mainAppOrigin(hostname)}${url.pathname}${url.search}`);
    }

    // Rewrite path to /hub/[domainKey]/...
    url.pathname = `/hub/${domainKey}${url.pathname}`;
    return NextResponse.rewrite(url);
  }

  // 3. Main domain auth checks
  if (
    url.pathname.startsWith("/dashboard") ||
    url.pathname.startsWith("/demos") ||
    url.pathname.startsWith("/settings")
  ) {
    return (authMiddleware as (req: NextRequest, event: NextFetchEvent) => unknown)(req, event);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icons|images|solid|gradient|background-default-images).*)",
  ],
};
