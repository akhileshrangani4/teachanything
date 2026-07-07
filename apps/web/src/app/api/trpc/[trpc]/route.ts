import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/routers/_app";
import { createTRPCContext } from "@/server/trpc";
import { env } from "@/lib/env";

// Disable static optimization for API routes
export const dynamic = "force-dynamic";

// Chat subscriptions stream long agentic turns (multiple LLM round trips plus
// retrieval) through this route. Without an explicit maxDuration Vercel applies
// the project default, which can kill the function mid-stream -- the client's
// EventSource then reconnects and replays the whole message.
export const maxDuration = 300;

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: async () => createTRPCContext({ headers: req.headers }),
    onError:
      env.NODE_ENV === "development"
        ? ({ path, error }) => {
            console.error(
              `❌ tRPC failed on ${path ?? "<no-path>"}: ${error.message}`,
            );
          }
        : undefined,
  });

export { handler as GET, handler as POST };
