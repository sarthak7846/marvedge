import { NextRequest, NextResponse, NextFetchEvent } from "next/server";
import { withAuth } from "next-auth/middleware";

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

  // 2. Subdomain & Custom domain routing
  const mainDomains = ["marvedge.io", "localhost:3000", "marvedge.vercel.app"];
  const isMainDomain = mainDomains.includes(hostname);
  const isSubdomain = hostname.endsWith(".localhost:3000") || hostname.endsWith(".marvedge.io");

  if (!isMainDomain || isSubdomain) {
    const domainKey = isSubdomain ? hostname.split(".")[0] : hostname.split(":")[0];
    console.log(
      `[Middleware] Subdomain/custom domain detected: "${hostname}" (Key: "${domainKey}"). Rewriting path to /hub/${domainKey}${url.pathname}`
    );

    // Redirect dashboard or auth pages back to the main domain
    if (url.pathname.startsWith("/dashboard") || url.pathname.startsWith("/auth")) {
      const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
      const targetDomain = hostname.endsWith(".localhost:3000") ? "localhost:3000" : "marvedge.io";
      return NextResponse.redirect(`${protocol}://${targetDomain}${url.pathname}${url.search}`);
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
