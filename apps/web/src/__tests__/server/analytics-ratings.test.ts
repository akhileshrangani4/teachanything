/**
 * @jest-environment node
 *
 * Runs the real getRatingsSummary query against a seeded Postgres database.
 * Needs TEST_DATABASE_URL pointing at a database with the Drizzle schema
 * applied (`drizzle-kit push` or `db:migrate`); skipped without it. Every test
 * seeds inside a transaction that is rolled back, so the database is left as
 * it was found.
 */
import { jest, describe, it, expect, afterAll } from "@jest/globals";
import { initTRPC } from "@trpc/server";
import { TransactionRollbackError } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@teachanything/db/schema";

// Opt-in and local only: run from apps/web (`TEST_DATABASE_URL=... npm test`),
// since Turbo's strict env mode does not pass undeclared vars through.
// eslint-disable-next-line turbo/no-undeclared-env-vars
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.SKIP_ENV_VALIDATION = "1";
process.env.DATABASE_URL =
  TEST_DATABASE_URL ?? "postgresql://test:test@localhost:5432/test";

// Stand-in for the real procedure builder, minus the session/approval
// middleware, which is not what these tests are about. Ownership is still
// enforced by assertOwnedChatbot against the seeded rows.
const t = initTRPC.context<{ db: unknown; session: unknown }>().create();
jest.unstable_mockModule("@/server/trpc", () => ({
  protectedProcedure: t.procedure,
}));

const { getRatingsSummaryProcedure, ratingsWindowStart, RATINGS_WINDOW_DAYS } =
  await import("@/server/routers/analytics/procedures/ratings");

const createCaller = t.createCallerFactory(
  t.router({ getRatingsSummary: getRatingsSummaryProcedure }),
);

const OWNER_ID = "ratings-owner";
const OTHER_OWNER_ID = "ratings-other-owner";
const DAY_MS = 24 * 60 * 60 * 1000;

/** One rating: which chatbot, the value, and how many days ago it was given. */
type SeedRating = {
  chatbot: "own" | "other";
  rating: "up" | "down";
  daysAgo: number;
};

describe("ratingsWindowStart", () => {
  it("starts exactly 30 days before now", () => {
    const now = new Date("2026-11-13T12:00:00.000Z");
    expect(RATINGS_WINDOW_DAYS).toBe(30);
    expect(ratingsWindowStart(now).toISOString()).toBe(
      "2026-10-14T12:00:00.000Z",
    );
  });
});

const describeWithDatabase = TEST_DATABASE_URL ? describe : describe.skip;

describeWithDatabase("getRatingsSummary (needs TEST_DATABASE_URL)", () => {
  const client = postgres(TEST_DATABASE_URL ?? "", {
    prepare: false,
    max: 1,
    onnotice: () => {},
  });
  const db = drizzle(client, { schema });
  type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

  afterAll(async () => {
    await client.end();
  });

  /** Runs `fn` in a transaction that is always rolled back. */
  async function inRolledBackTransaction<T>(
    fn: (tx: Transaction) => Promise<T>,
  ): Promise<T> {
    let outcome: { value: T } | undefined;
    try {
      await db.transaction(async (tx) => {
        outcome = { value: await fn(tx) };
        tx.rollback();
      });
    } catch (error) {
      if (!(error instanceof TransactionRollbackError)) throw error;
    }
    if (!outcome) throw new Error("Transaction finished without a result");
    return outcome.value;
  }

  /** Seeds two chatbots and one rated assistant message per rating. */
  async function seed(tx: Transaction, ratings: ReadonlyArray<SeedRating>) {
    await tx.insert(schema.user).values([
      { id: OWNER_ID, email: "owner@example.edu", status: "approved" },
      { id: OTHER_OWNER_ID, email: "other@example.edu", status: "approved" },
    ]);
    const [own, other] = await tx
      .insert(schema.chatbots)
      .values([
        { userId: OWNER_ID, name: "Biology", systemPrompt: "Teach." },
        { userId: OTHER_OWNER_ID, name: "Other", systemPrompt: "Teach." },
      ])
      .returning({ id: schema.chatbots.id });

    const now = Date.now();
    for (const [index, seedRating] of ratings.entries()) {
      const chatbotId = seedRating.chatbot === "own" ? own!.id : other!.id;
      const sessionId = `ratings-session-${index}`;
      const [conversation] = await tx
        .insert(schema.conversations)
        .values({ chatbotId, sessionId })
        .returning({ id: schema.conversations.id });
      const [message] = await tx
        .insert(schema.messages)
        .values({
          conversationId: conversation!.id,
          role: "assistant",
          content: "An answer.",
        })
        .returning({ id: schema.messages.id });
      const ratedAt = new Date(now - seedRating.daysAgo * DAY_MS);
      await tx.insert(schema.messageRatings).values({
        messageId: message!.id,
        chatbotId,
        sessionId,
        rating: seedRating.rating,
        createdAt: ratedAt,
        updatedAt: ratedAt,
      });
    }
    return { ownChatbotId: own!.id, otherChatbotId: other!.id };
  }

  function getRatingsSummary(tx: Transaction, chatbotId: string) {
    return createCaller({
      db: tx,
      session: { user: { id: OWNER_ID } },
    }).getRatingsSummary({ chatbotId });
  }

  it("counts only this chatbot's ratings from the last 30 days", async () => {
    const summary = await inRolledBackTransaction(async (tx) => {
      const { ownChatbotId } = await seed(tx, [
        { chatbot: "own", rating: "up", daysAgo: 0 },
        { chatbot: "own", rating: "up", daysAgo: 12 },
        { chatbot: "own", rating: "down", daysAgo: 29 },
        // Outside the window.
        { chatbot: "own", rating: "up", daysAgo: 31 },
        { chatbot: "own", rating: "down", daysAgo: 90 },
        // Another professor's chatbot.
        { chatbot: "other", rating: "down", daysAgo: 1 },
      ]);
      return getRatingsSummary(tx, ownChatbotId);
    });

    expect(summary).toEqual({ up: 2, down: 1 });
  });

  it("dates a re-rated message by its latest rating", async () => {
    const summary = await inRolledBackTransaction(async (tx) => {
      const { ownChatbotId } = await seed(tx, [
        { chatbot: "own", rating: "up", daysAgo: 45 },
      ]);
      // The student changes their mind today: the row moves into the window
      // with its new value.
      await tx
        .update(schema.messageRatings)
        .set({ rating: "down", updatedAt: new Date() });
      return getRatingsSummary(tx, ownChatbotId);
    });

    expect(summary).toEqual({ up: 0, down: 1 });
  });

  it("returns zero counts when nothing was rated (empty state)", async () => {
    const summary = await inRolledBackTransaction(async (tx) => {
      const { ownChatbotId } = await seed(tx, [
        { chatbot: "own", rating: "up", daysAgo: 31 },
      ]);
      return getRatingsSummary(tx, ownChatbotId);
    });

    expect(summary).toEqual({ up: 0, down: 0 });
  });

  it("rejects a chatbot the caller does not own", async () => {
    await expect(
      inRolledBackTransaction(async (tx) => {
        const { otherChatbotId } = await seed(tx, [
          { chatbot: "other", rating: "up", daysAgo: 1 },
        ]);
        return getRatingsSummary(tx, otherChatbotId);
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
