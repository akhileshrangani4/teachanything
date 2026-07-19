import { createTRPCReact, type CreateTRPCReact } from "@trpc/react-query";
import { httpBatchLink, loggerLink } from "@trpc/client";
import type { AppRouter } from "@/server/routers/_app";
import type { inferRouterOutputs } from "@trpc/server";
import superjson from "superjson";
import { env } from "./env";

// Create tRPC React hooks
export const trpc: CreateTRPCReact<AppRouter, unknown> =
  createTRPCReact<AppRouter>();

// Type helper for router outputs
export type RouterOutputs = inferRouterOutputs<AppRouter>;

// tRPC client configuration
export function getTRPCClientConfig() {
  return {
    links: [
      loggerLink({
        enabled: (opts) =>
          env.NODE_ENV === "development" ||
          (opts.direction === "down" && opts.result instanceof Error),
      }),
      httpBatchLink({
        url: `${getBaseUrl()}/api/trpc`,
        transformer: superjson,
      }),
    ],
  };
}

function getBaseUrl() {
  if (typeof window !== "undefined") {
    return "";
  }
  if (env.NEXT_PUBLIC_APP_URL) {
    return env.NEXT_PUBLIC_APP_URL;
  }
  return `http://localhost:${env.PORT}`;
}
