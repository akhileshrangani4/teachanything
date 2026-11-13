/**
 * @jest-environment node
 *
 * Runs the real getCommonQuestions query against a seeded Postgres database.
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

const { getCommonQuestionsProcedure } =
  await import("@/server/routers/analytics/procedures/insights");

const createCaller = t.createCallerFactory(
  t.router({ getCommonQuestions: getCommonQuestionsProcedure }),
);

const OWNER_ID = "common-questions-owner";
const OTHER_OWNER_ID = "common-questions-other-owner";
const BASE_TIME = Date.UTC(2026, 10, 1, 12, 0, 0);

/** One student session: its messages in order, each a minute apart. */
type SeedConversation = {
  chatbot: "own" | "other";
  messages: ReadonlyArray<{ role: "user" | "assistant"; content: string }>;
};

const describeWithDatabase = TEST_DATABASE_URL ? describe : describe.skip;

describeWithDatabase("getCommonQuestions (needs TEST_DATABASE_URL)", () => {
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

  async function seed(
    tx: Transaction,
    conversations: ReadonlyArray<SeedConversation>,
  ) {
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

    for (const [index, conversation] of conversations.entries()) {
      const [row] = await tx
        .insert(schema.conversations)
        .values({
          chatbotId: conversation.chatbot === "own" ? own!.id : other!.id,
          sessionId: `common-questions-session-${index}`,
        })
        .returning({ id: schema.conversations.id });
      // Later conversations are more recent; messages within one are ordered.
      const startedAt = BASE_TIME + index * 60 * 60 * 1000;
      await tx.insert(schema.messages).values(
        conversation.messages.map((message, position) => ({
          conversationId: row!.id,
          role: message.role,
          content: message.content,
          createdAt: new Date(startedAt + position * 60 * 1000),
        })),
      );
    }
    return own!.id;
  }

  function askedFirst(
    content: string,
    chatbot: SeedConversation["chatbot"] = "own",
  ): SeedConversation {
    return {
      chatbot,
      messages: [
        { role: "user", content },
        { role: "assistant", content: "An answer." },
      ],
    };
  }

  function getCommonQuestions(
    tx: Transaction,
    input: { chatbotId: string; limit?: number; offset?: number },
  ) {
    return createCaller({
      db: tx,
      session: { user: { id: OWNER_ID } },
    }).getCommonQuestions(input);
  }

  const ISSUE_EXAMPLE: ReadonlyArray<SeedConversation> = [
    askedFirst("What is photosynthesis?"),
    askedFirst("photosynthesis"),
    askedFirst("  whats  photosynthesis  "),
    askedFirst("what is mitosis"),
    askedFirst("what is meiosis"),
  ];

  it("groups the issue's three phrasings into one question with count 3", async () => {
    const result = await inRolledBackTransaction(async (tx) => {
      const chatbotId = await seed(tx, ISSUE_EXAMPLE);
      return getCommonQuestions(tx, { chatbotId });
    });

    expect(result.questions).toEqual([
      // Labelled with the most recent original wording, trimmed.
      { question: "whats  photosynthesis", count: 3 },
      { question: "what is meiosis", count: 1 },
      { question: "what is mitosis", count: 1 },
    ]);
    expect(result.totalCount).toBe(3);
  });

  it("paginates over normalized groups in the database", async () => {
    const pages = await inRolledBackTransaction(async (tx) => {
      const chatbotId = await seed(tx, ISSUE_EXAMPLE);
      return Promise.all(
        [0, 1, 2, 3].map((offset) =>
          getCommonQuestions(tx, { chatbotId, limit: 1, offset }),
        ),
      );
    });

    expect(pages.map((page) => page.questions)).toEqual([
      [{ question: "whats  photosynthesis", count: 3 }],
      [{ question: "what is meiosis", count: 1 }],
      [{ question: "what is mitosis", count: 1 }],
      [],
    ]);
    expect(pages.every((page) => page.totalCount === 3)).toBe(true);
  });

  it("counts only each session's first message, only for this chatbot", async () => {
    const result = await inRolledBackTransaction(async (tx) => {
      const chatbotId = await seed(tx, [
        {
          chatbot: "own",
          messages: [
            { role: "user", content: "Explain osmosis" },
            { role: "assistant", content: "An answer." },
            { role: "user", content: "what is osmosis" },
          ],
        },
        askedFirst("osmosis", "other"),
        askedFirst("???"),
      ]);
      return getCommonQuestions(tx, { chatbotId });
    });

    // The follow-up, the other chatbot's session and the punctuation-only
    // message all stay out of the count.
    expect(result.questions).toEqual([
      { question: "Explain osmosis", count: 1 },
    ]);
    expect(result.totalCount).toBe(1);
  });
});
