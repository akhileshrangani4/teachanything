import { describe, expect, it } from "@jest/globals";
import type { IncomingMessage } from "node:http";
import { buildCustomRoute } from "next/dist/lib/build-custom-route";
import { matchHas } from "next/dist/shared/lib/router/utils/prepare-destination";
import nextConfig from "../../../next.config.js";

type ResolvedHeaders = Record<string, string>;

const APP_HOST = "teachanything.ai";
const ADMIN_HOST = "admin.teachanything.ai";

/**
 * Resolves response headers the way Next's router does: compile each source
 * with Next's own route builder, check `has`/`missing`, and let later rules
 * override earlier ones for the same key.
 */
async function resolveHeaders(
  pathname: string,
  host = APP_HOST,
): Promise<ResolvedHeaders> {
  const rules = (await nextConfig.headers?.()) ?? [];
  const req = { headers: { host } } as unknown as IncomingMessage;
  const resolved: ResolvedHeaders = {};
  for (const rule of rules) {
    const { regex } = buildCustomRoute("header", rule);
    if (!new RegExp(regex).test(pathname)) continue;
    if (!matchHas(req, {}, rule.has, rule.missing)) continue;
    for (const { key, value } of rule.headers) resolved[key] = value;
  }
  return resolved;
}

const BASELINE = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=86400",
};

const FRAME_DENY = {
  "Content-Security-Policy": "frame-ancestors 'none'",
  "X-Frame-Options": "DENY",
};

const FRAMEABLE_ROUTES = [
  "/embed/abc/window",
  "/embed/abc/button",
  "/embed",
  "/chat/abc",
  "/chat",
];

const DENIED_ROUTES = [
  "/",
  "/admin",
  "/dashboard",
  "/dashboard/files",
  "/login",
  "/register",
  "/chatbot/abc",
  "/embedded",
  "/chats",
  "/api/trpc/chatbot.list",
];

const DOWNLOAD_ROUTE = "/api/files/file_123/download";

describe("next.config security headers", () => {
  it.each([...FRAMEABLE_ROUTES, ...DENIED_ROUTES, DOWNLOAD_ROUTE])(
    "%s gets nosniff, referrer policy and HSTS",
    async (route) => {
      expect(await resolveHeaders(route)).toMatchObject(BASELINE);
    },
  );

  it.each(FRAMEABLE_ROUTES)(
    "%s stays frameable (no frame-deny headers)",
    async (route) => {
      const headers = await resolveHeaders(route);
      expect(headers).not.toHaveProperty("Content-Security-Policy");
      expect(headers).not.toHaveProperty("X-Frame-Options");
    },
  );

  it.each(DENIED_ROUTES)(
    "%s gets frame-ancestors 'none' and X-Frame-Options DENY",
    async (route) => {
      expect(await resolveHeaders(route)).toMatchObject(FRAME_DENY);
    },
  );

  it("leaves framing on the file download route to its handler", async () => {
    const headers = await resolveHeaders(DOWNLOAD_ROUTE);
    expect(headers).not.toHaveProperty("Content-Security-Policy");
    expect(headers).not.toHaveProperty("X-Frame-Options");
  });

  it.each(["/", "/chat/abc", "/embed/abc/window", "/users"])(
    "denies framing of %s on the admin subdomain",
    async (route) => {
      expect(await resolveHeaders(route, ADMIN_HOST)).toMatchObject({
        ...BASELINE,
        ...FRAME_DENY,
      });
    },
  );

  it("sets no script Content-Security-Policy", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    const cspValues = rules
      .flatMap((rule) => rule.headers)
      .filter(({ key }) => key === "Content-Security-Policy")
      .map(({ value }) => value);
    expect(new Set(cspValues)).toEqual(new Set(["frame-ancestors 'none'"]));
  });
});
