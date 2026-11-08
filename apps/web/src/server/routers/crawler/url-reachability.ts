import type { TRPCError } from "@trpc/server";
import {
  UrlNotAllowedError,
  UrlUnreachableError,
  verifyUrlReachable,
} from "@teachanything/ai/crawler";
import { appError } from "@/server/app-error";

/** The user-facing error for a URL that failed the reachability check. */
export function urlReachabilityError(error: unknown): TRPCError {
  if (error instanceof UrlNotAllowedError) {
    return appError("BAD_REQUEST", "errors.crawler.urlNotAllowed");
  }
  if (error instanceof UrlUnreachableError && error.status !== undefined) {
    return appError("BAD_REQUEST", "errors.crawler.urlUnreachableStatus", {
      status: String(error.status),
    });
  }
  return appError("BAD_REQUEST", "errors.crawler.urlUnreachable");
}

export async function assertUrlReachable(url: string): Promise<void> {
  try {
    await verifyUrlReachable(url);
  } catch (error) {
    throw urlReachabilityError(error);
  }
}
