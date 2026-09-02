/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import {
  computeTrimmedHistory,
  groupStudyResponsesByToolCallId,
  type HistoryRow,
} from "@/server/chat/turn-context";

const row = (content: string, role = "user"): HistoryRow =>
  ({
    id: content,
    conversationId: "c1",
    role,
    content,
    metadata: null,
    createdAt: new Date(),
  }) as unknown as HistoryRow;

const base = {
  countTokens: (t: string) => t.length,
  contextWindow: 32_000,
  maxOutputTokens: 1_000,
  systemPromptTokens: 10,
  userMessageTokens: 10,
  ragResult: { fileManifest: "", contextText: "", ragFailureNote: "" },
  chatbotId: "cb1",
  modelId: "test-model",
};

describe("computeTrimmedHistory", () => {
  // The ordering contract spans two modules after the streamChat split:
  // fetchTurnContext queries newest-first, stream-chat.ts reverses into
  // chronological order, and this function slices the TAIL. If a future
  // caller drops the reverse, the model silently receives the OLDEST
  // messages instead of the most recent ones -- typecheck cannot see it,
  // so this test is the guard.
  it("keeps the most recent rows when the input is chronological", () => {
    const kept = computeTrimmedHistory({
      ...base,
      historyRows: [row("oldest"), row("middle"), row("newest")],
    });
    expect(kept[kept.length - 1]?.content).toBe("newest");
  });

  it("preserves relative order of the rows it keeps", () => {
    const rows = [row("a"), row("b"), row("c")];
    const kept = computeTrimmedHistory({ ...base, historyRows: rows });
    expect(kept.map((r) => r.content)).toEqual(["a", "b", "c"]);
  });

  it("returns an empty history when no budget is left for it", () => {
    const kept = computeTrimmedHistory({
      ...base,
      contextWindow: 1_100,
      historyRows: [row("a".repeat(50_000))],
    });
    expect(kept).toEqual([]);
  });

  it("returns an empty array for an empty history", () => {
    expect(computeTrimmedHistory({ ...base, historyRows: [] })).toEqual([]);
  });

  it("drops the oldest rows first when the history does not all fit", () => {
    const rows = Array.from({ length: 40 }, (_, i) =>
      row(`msg-${i}`.padEnd(4_000, "x")),
    );
    const kept = computeTrimmedHistory({
      ...base,
      contextWindow: 8_000,
      historyRows: rows,
    });
    expect(kept.length).toBeLessThan(rows.length);
    // Whatever survives must be a suffix of the input, never a prefix.
    expect(kept).toEqual(rows.slice(rows.length - kept.length));
  });
});

describe("groupStudyResponsesByToolCallId", () => {
  it("groups repeat attempts under one tool call id, in order", () => {
    const grouped = groupStudyResponsesByToolCallId([
      { toolCallId: "t1", toolName: "showQuiz", response: 1 },
      { toolCallId: "t1", toolName: "showQuiz", response: 2 },
      { toolCallId: "t2", toolName: "showQuiz", response: 3 },
    ]);
    expect(grouped.get("t1")?.map((r) => r.response)).toEqual([1, 2]);
    expect(grouped.get("t2")).toHaveLength(1);
  });

  it("returns an empty map for no rows", () => {
    expect(groupStudyResponsesByToolCallId([]).size).toBe(0);
  });

  it("keeps the tool name alongside each response", () => {
    const grouped = groupStudyResponsesByToolCallId([
      { toolCallId: "t1", toolName: "showQuiz", response: { score: 2 } },
    ]);
    expect(grouped.get("t1")?.[0]).toEqual({
      toolName: "showQuiz",
      response: { score: 2 },
    });
  });
});
