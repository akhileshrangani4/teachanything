import { describe, it, expect } from "@jest/globals";
import {
  rowToUIMessage,
  extractText,
  assistantMessageForDb,
} from "@/server/chat/ui-messages";

describe("rowToUIMessage", () => {
  it("rehydrates a legacy text row (no parts) into a single text part", () => {
    const msg = rowToUIMessage({
      id: "m1",
      role: "assistant",
      content: "Hello there",
      metadata: {},
    });
    expect(msg.role).toBe("assistant");
    expect(msg.parts).toEqual([{ type: "text", text: "Hello there" }]);
  });

  it("rehydrates a tool message from metadata.parts", () => {
    const parts = [
      { type: "text", text: "Here is a quiz:" },
      {
        type: "tool-showQuiz",
        toolCallId: "c1",
        state: "input-available",
        input: { quiz_title: "T", questions: [] },
      },
    ];
    const msg = rowToUIMessage({
      id: "m2",
      role: "assistant",
      content: "Here is a quiz:",
      metadata: { parts },
    });
    expect(msg.parts).toEqual(parts);
  });
});

describe("extractText", () => {
  it("joins only text parts", () => {
    expect(
      extractText([
        { type: "text", text: "a" },
        {
          type: "tool-showQuiz",
          toolCallId: "c",
          state: "input-available",
          input: {},
        },
        { type: "text", text: "b" },
      ] as never),
    ).toBe("a\nb");
  });
});

describe("assistantMessageForDb", () => {
  it("returns joined text as content and the full parts array", () => {
    const out = assistantMessageForDb({
      id: "m3",
      role: "assistant",
      parts: [
        { type: "text", text: "hi" },
        {
          type: "tool-showQuiz",
          toolCallId: "c",
          state: "input-available",
          input: {},
        },
      ],
    } as never);
    expect(out.content).toBe("hi");
    expect(out.parts).toHaveLength(2);
  });
});
