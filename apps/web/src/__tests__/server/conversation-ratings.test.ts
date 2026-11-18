/**
 * @jest-environment node
 *
 * Runs the real transcript and export queries against a seeded Postgres
 * database to check that each assistant message carries its student's rating,
 * and only the rating given in that conversation's own session.
 * Needs TEST_DATABASE_URL pointing at a database with the Drizzle schema
 * applied (`drizzle-kit push` or `db:migrate`); skipped without it. Every test
 * seeds inside a transaction that is rolled back.
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
// middleware. Ownership is still enforced against the seeded rows.
const t = initTRPC.context<{ db: unknown; session: unknown }>().create();
jest.unstable_mockModule("@/server/trpc", () => ({
  protectedProcedure: t.procedure,
}));
// The export's download limiter talks to Redis; it is not under test here.
jest.unstable_mockModule("@/server/rate-limit", () => ({
  checkRateLimit: async () => ({ success: true }),
  downloadRateLimit: {},
  conversationSearchRateLimit: {},
}));

const { getConversationMessagesProcedure } =
  await import("@/server/routers/analytics/procedures/conversations");
const { exportConversationsProcedure } =
  await import("@/server/routers/analytics/procedures/export-conversations");

const createCaller = t.createCallerFactory(
  t.router({
    getConversationMessages: getConversationMessagesProcedure,
    exportConversations: exportConversationsProcedure,
  }),
);

const OWNER_ID = "rated-transcript-owner";
const SESSION_ID = "rated-transcript-session";
const BASE_TIME = Date.UTC(2026, 10, 1, 12, 0, 0);

const describeWithDatabase = TEST_DATABASE_URL ? describe : describe.skip;

describeWithDatabase(
  "ratings in transcripts and exports (needs TEST_DATABASE_URL)",
  () => {
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

    /**
     * One conversation: a question and two answers. The student rated the first
     * answer down; a row from a different session also points at the second
     * answer and must not surface as this conversation's rating.
     */
    async function seed(tx: Transaction) {
      await tx.insert(schema.user).values({
        id: OWNER_ID,
        email: "owner@example.edu",
        status: "approved",
      });
      const [chatbot] = await tx
        .insert(schema.chatbots)
        .values({ userId: OWNER_ID, name: "Biology", systemPrompt: "Teach." })
        .returning({ id: schema.chatbots.id });
      const [conversation] = await tx
        .insert(schema.conversations)
        .values({ chatbotId: chatbot!.id, sessionId: SESSION_ID })
        .returning({ id: schema.conversations.id });
      const [, ratedAnswer, otherAnswer] = await tx
        .insert(schema.messages)
        .values(
          (
            [
              ["user", "What is osmosis?"],
              ["assistant", "Water moving across a membrane."],
              ["assistant", "Want an example?"],
            ] as const
          ).map(([role, content], position) => ({
            conversationId: conversation!.id,
            role,
            content,
            createdAt: new Date(BASE_TIME + position * 60 * 1000),
          })),
        )
        .returning({ id: schema.messages.id });
      await tx.insert(schema.messageRatings).values([
        {
          messageId: ratedAnswer!.id,
          chatbotId: chatbot!.id,
          sessionId: SESSION_ID,
          rating: "down",
        },
        {
          messageId: otherAnswer!.id,
          chatbotId: chatbot!.id,
          sessionId: "some-other-session",
          rating: "up",
        },
      ]);
      return { chatbotId: chatbot!.id, conversationId: conversation!.id };
    }

    function caller(tx: Transaction) {
      return createCaller({ db: tx, session: { user: { id: OWNER_ID } } });
    }

    it("marks the transcript's rated message with its session's rating", async () => {
      const transcript = await inRolledBackTransaction(async (tx) => {
        const ids = await seed(tx);
        return caller(tx).getConversationMessages(ids);
      });

      expect(transcript.messages.map((m) => [m.role, m.rating])).toEqual([
        ["user", null],
        ["assistant", "down"],
        ["assistant", null],
      ]);
      expect(transcript.totalCount).toBe(3);
    });

    it("exports each turn's rating from the conversation's own session", async () => {
      const exported = await inRolledBackTransaction(async (tx) => {
        const { chatbotId } = await seed(tx);
        return caller(tx).exportConversations({ chatbotId });
      });

      expect(exported.conversations).toHaveLength(1);
      expect(
        exported.conversations[0]!.messages.map((m) => [m.role, m.rating]),
      ).toEqual([
        ["user", null],
        ["assistant", "down"],
        ["assistant", null],
      ]);
    });
  },
);
