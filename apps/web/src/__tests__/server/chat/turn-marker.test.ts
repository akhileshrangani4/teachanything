/**
 * @jest-environment node
 *
 * Runs the real swapTurnMarker compare-and-set (#465) against Postgres. Needs
 * TEST_DATABASE_URL pointing at a database with the Drizzle schema applied
 * (`drizzle-kit push` or `db:migrate`); skipped without it.
 *
 * The race needs real contention between connections, which a rolled-back
 * transaction can't give, so rows are committed: every test gets its own
 * conversation under one test owner, deleted (with everything it cascades to)
 * before and after the suite.
 */
import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@teachanything/db/schema";
import { swapTurnMarker } from "@/server/chat/turn-marker";

// Opt-in and local only: run from apps/web (`TEST_DATABASE_URL=... npm test`),
// since Turbo's strict env mode does not pass undeclared vars through.
// eslint-disable-next-line turbo/no-undeclared-env-vars
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

const OWNER_ID = "turn-marker-test-owner";
const RACERS = 20;
const FIRST_TURN = "2026-11-13T12:00:00.000Z";
const SECOND_TURN = "2026-11-13T12:06:00.000Z";

type ConversationMetadata = typeof schema.conversations.$inferInsert.metadata;

const describeWithDatabase = TEST_DATABASE_URL ? describe : describe.skip;

describeWithDatabase("swapTurnMarker (needs TEST_DATABASE_URL)", () => {
  // A connection per racer, so the race is contention between sessions.
  const client = postgres(TEST_DATABASE_URL ?? "", {
    prepare: false,
    max: RACERS,
    onnotice: () => {},
  });
  const db = drizzle(client, { schema });
  let chatbotId: string;
  let sessions = 0;

  /** Cascades to the owner's chatbot and its conversations. */
  async function removeTestOwner() {
    await db.delete(schema.user).where(eq(schema.user.id, OWNER_ID));
  }

  beforeAll(async () => {
    await removeTestOwner(); // leftovers from an interrupted run
    await db.insert(schema.user).values({
      id: OWNER_ID,
      email: "turn-marker-test@example.edu",
      status: "approved",
    });
    const [chatbot] = await db
      .insert(schema.chatbots)
      .values({ userId: OWNER_ID, name: "Turn marker", systemPrompt: "Teach." })
      .returning({ id: schema.chatbots.id });
    chatbotId = chatbot!.id;
  });

  afterAll(async () => {
    await removeTestOwner();
    await client.end();
  });

  async function conversationWith(metadata: ConversationMetadata) {
    const [row] = await db
      .insert(schema.conversations)
      .values({
        chatbotId,
        sessionId: `${OWNER_ID}-session-${++sessions}`,
        metadata,
      })
      .returning({ id: schema.conversations.id });
    return row!.id;
  }

  async function metadataOf(conversationId: string) {
    const [row] = await db
      .select({ metadata: schema.conversations.metadata })
      .from(schema.conversations)
      .where(eq(schema.conversations.id, conversationId));
    return row!.metadata;
  }

  it("claims an idle session and keeps the other metadata keys", async () => {
    const id = await conversationWith({
      userAgent: "jest",
      referrer: "https://example.edu",
    });

    expect(await swapTurnMarker(db, id, null, FIRST_TURN)).toBe(true);
    expect(await metadataOf(id)).toEqual({
      userAgent: "jest",
      referrer: "https://example.edu",
      activeTurnAt: FIRST_TURN,
    });
  });

  it("claims a session whose metadata is NULL", async () => {
    const id = await conversationWith(null);

    expect(await swapTurnMarker(db, id, null, FIRST_TURN)).toBe(true);
    expect(await metadataOf(id)).toEqual({ activeTurnAt: FIRST_TURN });
  });

  it("refuses when the session holds a different marker", async () => {
    const id = await conversationWith({ activeTurnAt: FIRST_TURN });

    expect(await swapTurnMarker(db, id, null, SECOND_TURN)).toBe(false);
    expect(
      await swapTurnMarker(db, id, "2026-11-13T11:00:00.000Z", SECOND_TURN),
    ).toBe(false);
    expect(await metadataOf(id)).toEqual({ activeTurnAt: FIRST_TURN });
  });

  it("replaces the marker it observed (expired-turn takeover)", async () => {
    const id = await conversationWith({ activeTurnAt: FIRST_TURN });

    expect(await swapTurnMarker(db, id, FIRST_TURN, SECOND_TURN)).toBe(true);
    expect(await metadataOf(id)).toEqual({ activeTurnAt: SECOND_TURN });
  });

  it("releases only the marker, once", async () => {
    const id = await conversationWith({
      userAgent: "jest",
      activeTurnAt: FIRST_TURN,
    });

    expect(await swapTurnMarker(db, id, FIRST_TURN, null)).toBe(true);
    expect(await metadataOf(id)).toEqual({ userAgent: "jest" });
    // A second release finds no marker to match and changes nothing.
    expect(await swapTurnMarker(db, id, FIRST_TURN, null)).toBe(false);
    expect(await metadataOf(id)).toEqual({ userAgent: "jest" });
  });

  it("leaves a newer turn's marker alone when an old turn releases", async () => {
    const id = await conversationWith({ activeTurnAt: SECOND_TURN });

    expect(await swapTurnMarker(db, id, FIRST_TURN, null)).toBe(false);
    expect(await metadataOf(id)).toEqual({ activeTurnAt: SECOND_TURN });
  });

  it("doesn't write to a conversation that doesn't exist", async () => {
    expect(await swapTurnMarker(db, randomUUID(), null, FIRST_TURN)).toBe(
      false,
    );
  });

  it(`lets exactly one of ${RACERS} concurrent claims win`, async () => {
    const id = await conversationWith({});
    const markers = Array.from({ length: RACERS }, (_, racer) =>
      new Date(Date.parse(FIRST_TURN) + racer).toISOString(),
    );

    const won = await Promise.all(
      markers.map((marker) => swapTurnMarker(db, id, null, marker)),
    );

    const winners = markers.filter((_, racer) => won[racer]);
    expect(winners).toHaveLength(1);
    expect(await metadataOf(id)).toEqual({ activeTurnAt: winners[0] });
  });
});
