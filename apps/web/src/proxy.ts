import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
// Note: Better Auth session check happens in tRPC context
// Middleware focuses on rate limiting and subdomain routing
import { publicChatRateLimit, checkRateLimit } from "@/server/rate-limit";
import { getTrustedClientIp } from "./lib/get-client-ip";
import { logWarn } from "./lib/logger";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") || "";

  // Handle subdomain routing for admin
  const isAdminSubdomain = host.startsWith("admin.");
  if (isAdminSubdomain && !pathname.startsWith("/admin")) {
    // Rewrite admin subdomain to /admin routes
    const url = request.nextUrl.clone();
    url.pathname = `/admin${pathname}`;
    return NextResponse.rewrite(url);
  }

  // Rate limiting for public chat endpoints
  if (pathname.startsWith("/chat/") || pathname === "/api/chat/shared") {
    const ip = getTrustedClientIp(request.headers);
    const { success, limit, remaining, reset } = await checkRateLimit(
      publicChatRateLimit,
      ip,
      { pathname, ip },
    );

    if (!success) {
      logWarn("Rate limit exceeded for public chat", {
        ip,
        pathname,
        limit,
        remaining,
        reset,
      });

      return NextResponse.json(
        {
          error: "Too many requests",
          message: "Please try again later",
          retryAfter: Math.ceil((reset - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": limit.toString(),
            "X-RateLimit-Remaining": remaining.toString(),
            "X-RateLimit-Reset": reset.toString(),
          },
        },
      );
    }
  }

  // Note: Authentication checks are handled by tRPC procedures
  // Protected routes will check session in the API layer
  // This keeps proxy lightweight and Node.js runtime compatible

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
