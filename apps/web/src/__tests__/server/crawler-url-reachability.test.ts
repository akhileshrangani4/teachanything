import { describe, it, expect } from "@jest/globals";
import {
  UrlNotAllowedError,
  UrlUnreachableError,
} from "@teachanything/ai/crawler";
import { urlReachabilityError } from "@/server/routers/crawler/url-reachability";
import { AppErrorCause } from "@/server/app-error";

const cause = (error: unknown) =>
  urlReachabilityError(error).cause as AppErrorCause;

describe("urlReachabilityError", () => {
  it("tells a blocked URL apart", () => {
    expect(cause(new UrlNotAllowedError()).key).toBe(
      "errors.crawler.urlNotAllowed",
    );
  });

  it("keeps the HTTP status", () => {
    const error = urlReachabilityError(new UrlUnreachableError(403));
    expect(error.message).toContain("(403)");
    expect((error.cause as AppErrorCause).key).toBe(
      "errors.crawler.urlUnreachableStatus",
    );
    expect((error.cause as AppErrorCause).values).toEqual({ status: "403" });
  });

  it("uses the plain message for network failures", () => {
    expect(cause(new TypeError("fetch failed")).key).toBe(
      "errors.crawler.urlUnreachable",
    );
    expect(cause(new UrlUnreachableError(undefined)).key).toBe(
      "errors.crawler.urlUnreachable",
    );
  });
});
