import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ req, token }) => {
        // Public paths that don't require authentication
        const publicPaths = [
          "/login",
          "/register",
          "/chat/shared",
          "/embed",
          "/",
          "/api/auth",
        ];

        const pathname = req.nextUrl.pathname;

        // Check if path is public
        const isPublicPath = publicPaths.some((path) =>
          pathname.startsWith(path),
        );

        if (isPublicPath) {
          return true;
        }

        // Require token for all other paths
        return !!token;
      },
    },
    pages: {
      signIn: "/login",
    },
  },
);

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
};
