/**
 * Newsletter router — input validation tests.
 *
 * The router itself delegates to external services (Resend) and relies on the
 * tRPC middleware for authentication. Instead of spinning up a full tRPC
 * caller we mirror the Zod schemas from newsletter.ts and verify they accept
 * and reject the right shapes — the same technique used in env.test.ts.
 */
import { describe, it, expect } from "@jest/globals";
import { z } from "zod";

// Mirror of the subscribe input schema in newsletter.ts
const subscribeInput = z.object({
  email: z.string().email(),
  firstName: z.string().trim().max(100).optional(),
});

// Mirror of the sendBroadcast input schema in newsletter.ts
const sendBroadcastInput = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(50000),
});

describe("newsletter router — subscribe input", () => {
  it("accepts a valid email address", () => {
    expect(() =>
      subscribeInput.parse({ email: "user@example.com" }),
    ).not.toThrow();
  });

  it("rejects a non-email string", () => {
    expect(() => subscribeInput.parse({ email: "not-an-email" })).toThrow();
  });

  it("accepts an optional firstName", () => {
    const result = subscribeInput.parse({
      email: "user@example.com",
      firstName: "Alice",
    });
    expect(result.firstName).toBe("Alice");
  });

  it("trims whitespace from firstName", () => {
    const result = subscribeInput.parse({
      email: "user@example.com",
      firstName: "  Alice  ",
    });
    expect(result.firstName).toBe("Alice");
  });

  it("rejects firstName longer than 100 characters", () => {
    expect(() =>
      subscribeInput.parse({
        email: "user@example.com",
        firstName: "A".repeat(101),
      }),
    ).toThrow();
  });

  it("accepts firstName at exactly 100 characters", () => {
    expect(() =>
      subscribeInput.parse({
        email: "user@example.com",
        firstName: "A".repeat(100),
      }),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Rate-limit IP extraction (mirrors logic in newsletter.ts subscribe handler)
// ---------------------------------------------------------------------------
describe("newsletter router — rate limit IP extraction", () => {
  it("uses the first address from a comma-separated x-forwarded-for header", () => {
    const header = "203.0.113.1, 10.0.0.1, 192.168.1.1";
    const clientIp = header.split(",")[0]?.trim() ?? "unknown";
    expect(clientIp).toBe("203.0.113.1");
  });

  it("trims whitespace from the extracted IP", () => {
    const header = "  203.0.113.5  , 10.0.0.2";
    const clientIp = header.split(",")[0]?.trim() ?? "unknown";
    expect(clientIp).toBe("203.0.113.5");
  });

  it("falls back to 'unknown' when x-forwarded-for is absent", () => {
    const header: string | undefined = undefined;
    const clientIp = header?.split(",")[0]?.trim() ?? "unknown";
    expect(clientIp).toBe("unknown");
  });
});

describe("newsletter router — sendBroadcast input", () => {
  it("accepts valid subject and body", () => {
    expect(() =>
      sendBroadcastInput.parse({ subject: "Hello", body: "World" }),
    ).not.toThrow();
  });

  it("rejects an empty subject", () => {
    expect(() =>
      sendBroadcastInput.parse({ subject: "", body: "Body" }),
    ).toThrow();
  });

  it("rejects a subject exceeding 200 characters", () => {
    expect(() =>
      sendBroadcastInput.parse({ subject: "S".repeat(201), body: "Body" }),
    ).toThrow();
  });

  it("accepts a subject at exactly 200 characters", () => {
    expect(() =>
      sendBroadcastInput.parse({ subject: "S".repeat(200), body: "Body" }),
    ).not.toThrow();
  });

  it("rejects an empty body", () => {
    expect(() =>
      sendBroadcastInput.parse({ subject: "Subject", body: "" }),
    ).toThrow();
  });

  it("rejects body exceeding 50000 characters", () => {
    expect(() =>
      sendBroadcastInput.parse({
        subject: "Subject",
        body: "B".repeat(50001),
      }),
    ).toThrow();
  });

  it("accepts body at exactly 50000 characters", () => {
    expect(() =>
      sendBroadcastInput.parse({
        subject: "Subject",
        body: "B".repeat(50000),
      }),
    ).not.toThrow();
  });
});
