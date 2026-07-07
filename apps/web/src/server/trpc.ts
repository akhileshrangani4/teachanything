import { initTRPC, TRPCError } from "@trpc/server";
import { ZodError } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@teachanything/db";
import { logError, logWarn } from "@/lib/logger";
import type { User } from "@/types/better-auth";
import superjson from "superjson";

/**
 * Create tRPC context from request headers
 */
export async function createTRPCContext(opts: { headers: Headers }) {
  // Get session from Better Auth
  const session = await auth.api.getSession({ headers: opts.headers });

  return {
    session: session || null,
    db,
    headers: opts.headers,
  };
}

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

// Initialize tRPC
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  sse: {
    // Keep-alive comments on subscription streams. Agentic chat turns can go
    // 10-30s with nothing on the wire (tool execution, reasoning phases);
    // idle SSE connections get dropped by proxies, and a drop makes the
    // client's EventSource reconnect and replay the whole message.
    ping: { enabled: true, intervalMs: 10_000 },
  },
  errorFormatter({ shape, error }) {
    // Only surface Zod validation errors to the client. Spreading any
    // `cause.message` leaks provider/internal error details (upstream URLs,
    // API key fragments, raw response bodies) for every router, not just
    // validation failures.
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * Logging middleware - logs all tRPC calls with timing (disabled by default)
 */
const loggingMiddleware = t.middleware(async ({ path, type, next, ctx }) => {
  // Logging disabled for cleaner console output
  // Set ENABLE_LOGGING=true in .env to enable
  try {
    return await next();
  } catch (error) {
    // Only log errors
    const userId = ctx.session?.user?.id;
    logError(error, `[tRPC] ${type} ${path} failed`, {
      userId,
      path,
      type,
    });
    throw error;
  }
});

// Public procedure (no auth required)
export const publicProcedure = t.procedure.use(loggingMiddleware);

// Protected procedure (requires auth)
export const protectedProcedure = t.procedure
  .use(loggingMiddleware)
  .use(async ({ ctx, next }) => {
    if (!ctx.session || !ctx.session.user) {
      logWarn("[tRPC] Unauthorized access attempt", {
        session: ctx.session,
      });
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "You must be logged in to access this resource",
      });
    }

    // Check if user is approved
    const user = ctx.session.user as User;

    // Admins bypass the approval workflow
    if (user.role !== "admin" && user.status !== "approved") {
      logWarn("[tRPC] Unapproved user access attempt", {
        userId: user.id,
        status: user.status,
      });
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Your account is pending admin approval",
      });
    }

    return next({
      ctx: {
        ...ctx,
        session: ctx.session,
      },
    });
  });

// Admin procedure (requires admin role)
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const user = ctx.session.user as User;

  if (user.role !== "admin") {
    logWarn("[tRPC] Non-admin access attempt to admin endpoint", {
      userId: user.id,
      role: user.role,
    });
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You must be an admin to access this resource",
    });
  }

  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
  });
});

// Export router and procedure builders
export const router = t.router;
export const middleware = t.middleware;
