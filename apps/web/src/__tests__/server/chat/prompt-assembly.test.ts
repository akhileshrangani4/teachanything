/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import { buildTurnPrompts } from "@/server/chat/prompt-assembly";
import type { HistoryRow } from "@/server/chat/turn-context";
import type { StudyUIMessage } from "@/server/chat/study-tools";
import { PARTS_VERSION } from "@/lib/chat/ui-messages";

const ragResult = {
  fileManifest: "[MANIFEST]",
  contextText: "[CONTEXT]",
  ragFailureNote: "[RAG-FAILED]",
} as never;

const userMessage = {
  id: "u1",
  role: "user",
  parts: [{ type: "text", text: "hi" }],
} as unknown as StudyUIMessage;

const assistantRowWithQuiz = {
  id: "m1",
  conversationId: "c1",
  role: "assistant",
  content: "here is a quiz",
  metadata: {
    // rowToUIMessage only trusts `parts` when the version stamp matches;
    // without it the row degrades to a single text part.
    partsVersion: PARTS_VERSION,
    parts: [
      { type: "text", text: "here is a quiz" },
      {
        type: "tool-showQuiz",
        toolCallId: "t1",
        state: "output-available",
        input: { questions: [] },
        output: undefined,
      },
    ],
  },
  createdAt: new Date(),
} as unknown as HistoryRow;

const base = {
  chatbotSystemPrompt: "[BASE]",
  ragResult,
  maxOutputTokens: 2_000,
  trimmedHistory: [] as HistoryRow[],
  userMessage,
  studyResponsesByToolCallId: new Map(),
};

describe("buildTurnPrompts", () => {
  it("adds the grounding rule only on the retrieval path", () => {
    const withTools = buildTurnPrompts({
      ...base,
      modelCanUseTools: true,
      useRetrievalTools: true,
    });
    const without = buildTurnPrompts({
      ...base,
      modelCanUseTools: true,
      useRetrievalTools: false,
    });
    expect(withTools.primarySystemPrompt).toContain(
      "search the attached documents",
    );
    expect(without.primarySystemPrompt).not.toContain(
      "search the attached documents",
    );
  });

  it("prepends the RAG failure note on the non-retrieval and fallback prompts", () => {
    const r = buildTurnPrompts({
      ...base,
      modelCanUseTools: true,
      useRetrievalTools: false,
    });
    expect(r.primarySystemPrompt.startsWith("[RAG-FAILED]")).toBe(true);
    expect(r.fallbackSystemPrompt.startsWith("[RAG-FAILED]")).toBe(true);
  });

  it("never puts the failure note on the retrieval primary prompt", () => {
    const r = buildTurnPrompts({
      ...base,
      modelCanUseTools: true,
      useRetrievalTools: true,
    });
    expect(r.primarySystemPrompt.startsWith("[BASE]")).toBe(true);
  });

  it("keeps the fallback prompt free of tool instructions", () => {
    const r = buildTurnPrompts({
      ...base,
      modelCanUseTools: true,
      useRetrievalTools: true,
    });
    expect(r.fallbackSystemPrompt).not.toContain(
      "search the attached documents",
    );
  });

  // A model without tool support must not receive persisted tool-call parts:
  // some providers 400 the whole turn. This fires when a chatbot is switched
  // to a non-tool model after a quiz was already saved to its history.
  it("strips persisted tool parts for a non-tool model", () => {
    const r = buildTurnPrompts({
      ...base,
      trimmedHistory: [assistantRowWithQuiz],
      modelCanUseTools: false,
      useRetrievalTools: false,
    });
    const parts = r.uiMessages[0]?.parts as Array<{ type: string }>;
    expect(parts.some((p) => p.type.startsWith("tool-"))).toBe(false);
  });

  it("preserves tool parts for a tool-capable model", () => {
    const r = buildTurnPrompts({
      ...base,
      trimmedHistory: [assistantRowWithQuiz],
      modelCanUseTools: true,
      useRetrievalTools: true,
    });
    const parts = r.uiMessages[0]?.parts as Array<{ type: string }>;
    expect(parts.some((p) => p.type.startsWith("tool-"))).toBe(true);
  });

  it("always appends the new user message last", () => {
    const r = buildTurnPrompts({
      ...base,
      trimmedHistory: [assistantRowWithQuiz],
      modelCanUseTools: true,
      useRetrievalTools: true,
    });
    expect(r.uiMessages).toHaveLength(2);
    expect(r.uiMessages[r.uiMessages.length - 1]).toBe(userMessage);
  });
});
