/**
 * @jest-environment node
 *
 * admin.sendRegistrationEmail: input validation, the pending-only gate, both
 * rate limits, and which email wrapper each template dispatches to.
 */
import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { initTRPC, TRPCError } from "@trpc/server";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { emailDeliveries } from "@teachanything/db/schema";

process.env.SKIP_ENV_VALIDATION = "1";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
};
type SendParams = Record<string, unknown>;

const mockCheckRateLimit = jest.fn<() => Promise<RateLimitResult>>();
const mockSendRequestMoreInfo = jest.fn<(p: SendParams) => Promise<void>>();
const mockSendIncorrectInfo = jest.fn<(p: SendParams) => Promise<void>>();
const mockSendGeneric = jest.fn<(p: SendParams) => Promise<void>>();

// Stand-in for the real procedure builder, minus the admin middleware.
const t = initTRPC
  .context<{ db: unknown; session: unknown; headers: Headers }>()
  .create();

jest.unstable_mockModule("@/server/trpc", () => ({
  adminProcedure: t.procedure,
}));
jest.unstable_mockModule("@/server/rate-limit", () => ({
  adminActionRateLimit: {},
  checkRateLimit: mockCheckRateLimit,
}));
jest.unstable_mockModule("@/server/email", () => ({
  sendRequestMoreInfoEmail: mockSendRequestMoreInfo,
  sendIncorrectInfoEmail: mockSendIncorrectInfo,
  sendGenericAdminEmail: mockSendGeneric,
}));
jest.unstable_mockModule("@/lib/logger", () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarn: jest.fn(),
}));

const {
  sendRegistrationEmailProcedure,
  sendRegistrationEmailInputSchema,
  MAX_REGISTRATION_EMAILS_PER_USER_PER_DAY,
} = await import("@/server/routers/admin/procedures/registration-email");

const createCaller = t.createCallerFactory(
  t.router({ sendRegistrationEmail: sendRegistrationEmailProcedure }),
);

const ADMIN_ID = "admin-1";
const PENDING_USER = {
  id: "user-1",
  email: "pending@test.edu",
  name: "  Dana Lee  ",
  status: "pending",
};

/**
 * Minimal db for the two reads the procedure makes: the user lookup
 * (`.where().limit()`) and the delivery count (`.where()` awaited directly).
 * Captures the count's WHERE clause so its filters can be asserted.
 */
function fakeDb(opts: { user?: Record<string, unknown>; sentCount?: number }) {
  const captured: { countWhere?: SQL } = {};
  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: (clause: SQL) => {
          if (table === emailDeliveries) {
            captured.countWhere = clause;
            return Promise.resolve([{ count: opts.sentCount ?? 0 }]);
          }
          return { limit: async () => (opts.user ? [opts.user] : []) };
        },
      }),
    }),
  };
  return { db, captured };
}

function callerFor(db: unknown) {
  return createCaller({
    db,
    headers: new Headers(),
    session: { user: { id: ADMIN_ID, role: "admin" } },
  });
}

async function errorFrom(promise: Promise<unknown>): Promise<TRPCError> {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(TRPCError);
  return error as TRPCError;
}

beforeEach(() => {
  mockCheckRateLimit.mockResolvedValue({
    success: true,
    limit: 20,
    remaining: 19,
    reset: 0,
  });
  mockSendRequestMoreInfo.mockResolvedValue(undefined);
  mockSendIncorrectInfo.mockResolvedValue(undefined);
  mockSendGeneric.mockResolvedValue(undefined);
});

describe("sendRegistrationEmailInputSchema", () => {
  const parse = (input: unknown) =>
    sendRegistrationEmailInputSchema.safeParse(input);

  it("accepts the two fixed templates without a message", () => {
    expect(
      parse({ userId: "u", templateId: "request_more_info" }).success,
    ).toBe(true);
    expect(parse({ userId: "u", templateId: "incorrect_info" }).success).toBe(
      true,
    );
  });

  it("rejects a customMessage on a template that ignores it", () => {
    expect(
      parse({
        userId: "u",
        templateId: "request_more_info",
        customMessage: "hello",
      }).success,
    ).toBe(false);
  });

  it("requires a non-blank customMessage for the custom template", () => {
    expect(
      parse({ userId: "u", templateId: "generic_admin_message" }).success,
    ).toBe(false);
    expect(
      parse({
        userId: "u",
        templateId: "generic_admin_message",
        customMessage: "   ",
      }).success,
    ).toBe(false);
  });

  it("trims the customMessage", () => {
    const result = parse({
      userId: "u",
      templateId: "generic_admin_message",
      customMessage: "  Please send your webpage.  ",
    });
    expect(result.success && result.data).toMatchObject({
      customMessage: "Please send your webpage.",
    });
  });

  it("caps the customMessage at 1000 characters", () => {
    const base = { userId: "u", templateId: "generic_admin_message" };
    expect(parse({ ...base, customMessage: "a".repeat(1000) }).success).toBe(
      true,
    );
    expect(parse({ ...base, customMessage: "a".repeat(1001) }).success).toBe(
      false,
    );
  });

  it("rejects an empty userId and unknown templates", () => {
    expect(parse({ userId: "", templateId: "incorrect_info" }).success).toBe(
      false,
    );
    expect(parse({ userId: "u", templateId: "approval" }).success).toBe(false);
  });
});

describe("admin.sendRegistrationEmail", () => {
  it("dispatches each template to its wrapper with the sender recorded", async () => {
    const { db } = fakeDb({ user: PENDING_USER });
    const caller = callerFor(db);

    await caller.sendRegistrationEmail({
      userId: "user-1",
      templateId: "request_more_info",
    });
    await caller.sendRegistrationEmail({
      userId: "user-1",
      templateId: "incorrect_info",
    });
    await expect(
      caller.sendRegistrationEmail({
        userId: "user-1",
        templateId: "generic_admin_message",
        customMessage: "  Line one\n\nLine two  ",
      }),
    ).resolves.toEqual({ success: true });

    const expected = {
      email: "pending@test.edu",
      name: "Dana Lee",
      sentByAdminId: ADMIN_ID,
    };
    expect(mockSendRequestMoreInfo).toHaveBeenCalledWith(expected);
    expect(mockSendIncorrectInfo).toHaveBeenCalledWith(expected);
    expect(mockSendGeneric).toHaveBeenCalledWith({
      ...expected,
      customMessage: "Line one\n\nLine two",
    });
  });

  it("falls back to 'User' when the name is missing or blank", async () => {
    for (const name of [null, "   "]) {
      const { db } = fakeDb({ user: { ...PENDING_USER, name } });
      await callerFor(db).sendRegistrationEmail({
        userId: "user-1",
        templateId: "incorrect_info",
      });
    }
    for (const [params] of mockSendIncorrectInfo.mock.calls) {
      expect(params.name).toBe("User");
    }
  });

  it("returns NOT_FOUND for an unknown user", async () => {
    const { db } = fakeDb({});
    const error = await errorFrom(
      callerFor(db).sendRegistrationEmail({
        userId: "missing",
        templateId: "incorrect_info",
      }),
    );
    expect(error.code).toBe("NOT_FOUND");
  });

  it.each(["approved", "rejected"])(
    "refuses to email a %s user",
    async (status) => {
      const { db } = fakeDb({ user: { ...PENDING_USER, status } });
      const error = await errorFrom(
        callerFor(db).sendRegistrationEmail({
          userId: "user-1",
          templateId: "generic_admin_message",
          customMessage: "hello",
        }),
      );
      expect(error.code).toBe("BAD_REQUEST");
      expect(mockSendGeneric).not.toHaveBeenCalled();
    },
  );

  it("rate limits per admin before touching the user", async () => {
    mockCheckRateLimit.mockResolvedValue({
      success: false,
      limit: 20,
      remaining: 0,
      reset: 0,
    });
    const { db, captured } = fakeDb({ user: PENDING_USER });
    const error = await errorFrom(
      callerFor(db).sendRegistrationEmail({
        userId: "user-1",
        templateId: "request_more_info",
      }),
    );
    expect(error.code).toBe("TOO_MANY_REQUESTS");
    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      {},
      ADMIN_ID,
      expect.anything(),
    );
    expect(captured.countWhere).toBeUndefined();
    expect(mockSendRequestMoreInfo).not.toHaveBeenCalled();
  });

  it("stops at the daily per-recipient cap", async () => {
    const { db } = fakeDb({
      user: PENDING_USER,
      sentCount: MAX_REGISTRATION_EMAILS_PER_USER_PER_DAY,
    });
    const error = await errorFrom(
      callerFor(db).sendRegistrationEmail({
        userId: "user-1",
        templateId: "request_more_info",
      }),
    );
    expect(error.code).toBe("TOO_MANY_REQUESTS");
    expect(mockSendRequestMoreInfo).not.toHaveBeenCalled();
  });

  it("sends while under the cap", async () => {
    const { db } = fakeDb({
      user: PENDING_USER,
      sentCount: MAX_REGISTRATION_EMAILS_PER_USER_PER_DAY - 1,
    });
    await callerFor(db).sendRegistrationEmail({
      userId: "user-1",
      templateId: "request_more_info",
    });
    expect(mockSendRequestMoreInfo).toHaveBeenCalledTimes(1);
  });

  it("does not count failed deliveries against the cap", async () => {
    const { db, captured } = fakeDb({ user: PENDING_USER });
    await callerFor(db).sendRegistrationEmail({
      userId: "user-1",
      templateId: "request_more_info",
    });

    const query = new PgDialect().sqlToQuery(captured.countWhere!);
    expect(query.sql).toContain('"delivery_status" in');
    expect(query.params).toEqual(
      expect.arrayContaining(["queued", "sent", "delivered"]),
    );
    expect(query.params).not.toContain("failed");
    expect(query.params).not.toContain("bounced");
  });
});
