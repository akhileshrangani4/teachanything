import { auth } from "@/server/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  loginRateLimit,
  registrationRateLimit,
  checkRateLimit,
} from "@/server/rate-limit";
import { getTrustedClientIp } from "@/lib/get-client-ip";

const { GET: authGET, POST: authPOST } = toNextJsHandler(auth);

export { authGET as GET };

export async function POST(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Key on the edge-derived IP, never the client-supplied leftmost XFF hop:
  // rotating that hop would otherwise mint a fresh bucket per request.
  const ip = getTrustedClientIp(request.headers);

  // Rate limit login attempts
  if (pathname === "/api/auth/sign-in/email") {
    const { success, limit, remaining, reset } = await checkRateLimit(
      loginRateLimit,
      ip,
      { pathname, ip, endpoint: "login" },
    );

    if (!success) {
      return NextResponse.json(
        {
          error: "Too many login attempts",
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

  // Rate limit registration attempts
  if (pathname === "/api/auth/sign-up/email") {
    const { success, limit, remaining, reset } = await checkRateLimit(
      registrationRateLimit,
      ip,
      { pathname, ip, endpoint: "registration" },
    );

    if (!success) {
      return NextResponse.json(
        {
          error: "Too many registration attempts",
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

  return authPOST(request);
}
