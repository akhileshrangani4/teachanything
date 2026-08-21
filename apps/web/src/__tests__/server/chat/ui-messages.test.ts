import { describe, it, expect } from "@jest/globals";
import {
  rowToUIMessage,
  extractText,
  assistantMessageForDb,
  hasPersistableStudyPart,
  stripToolPartsForTextModel,
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

  it("rehydrates a tool message from version-stamped metadata.parts", () => {
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
      metadata: { parts, partsVersion: 1 },
    });
    expect(msg.parts).toEqual(parts);
  });

  it("falls back to the content text part when parts lack a version stamp", () => {
    const msg = rowToUIMessage({
      id: "m6",
      role: "assistant",
      content: "plain",
      metadata: { parts: [{ type: "text", text: "unstamped" }] },
    });
    expect(msg.parts).toEqual([{ type: "text", text: "plain" }]);
  });

  it("falls back on null metadata, empty parts, and corrupt parts", () => {
    const fallback = [{ type: "text", text: "safe" }];
    const rows = [
      { metadata: null },
      { metadata: { parts: [], partsVersion: 1 } },
      { metadata: { parts: "corrupt", partsVersion: 1 } },
      { metadata: { parts: [{ noType: true }], partsVersion: 1 } },
      { metadata: { parts: [null], partsVersion: 1 } },
    ];
    for (const row of rows) {
      const msg = rowToUIMessage({
        id: "m7",
        role: "assistant",
        content: "safe",
        ...row,
      });
      expect(msg.parts).toEqual(fallback);
    }
  });

  it("carries metadata (sources/truncated/responseTime) for the dashboard viewer", () => {
    const sources = [{ fileName: "a.pdf", chunkIndex: 1, similarity: 0.9 }];
    const msg = rowToUIMessage({
      id: "m4",
      role: "assistant",
      content: "hi",
      metadata: { sources, truncated: true, responseTime: 120 },
    });
    expect(msg.metadata?.sources).toEqual(sources);
    expect(msg.metadata?.truncated).toBe(true);
    expect(msg.metadata?.responseTime).toBe(120);
  });

  it("leaves metadata fields undefined for a legacy row", () => {
    const msg = rowToUIMessage({
      id: "m5",
      role: "assistant",
      content: "legacy",
      metadata: {},
    });
    expect(msg.metadata?.sources).toBeUndefined();
    expect(msg.metadata?.truncated).toBeUndefined();
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

  it("returns empty string for a quiz-only turn (no text parts)", () => {
    // Load-bearing: this empty content drives the `content.trim() ||
    // hasStudyPart` persistence branch so quiz-only turns still save.
    expect(
      extractText([
        {
          type: "tool-showQuiz",
          toolCallId: "c",
          state: "input-available",
          input: {},
        },
      ] as never),
    ).toBe("");
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

  it("completes render-only quiz parts so convertToModelMessages keeps them", () => {
    const input = { quiz_title: "T", questions: [] };
    const out = assistantMessageForDb({
      id: "m8",
      role: "assistant",
      parts: [
        {
          type: "tool-showQuiz",
          toolCallId: "c",
          state: "input-available",
          input,
        },
      ],
    } as never);
    expect(out.parts).toEqual([
      {
        type: "tool-showQuiz",
        toolCallId: "c",
        state: "output-available",
        output: "rendered",
        input,
      },
    ]);
  });

  it("leaves errored quiz parts untouched", () => {
    const parts = [
      {
        type: "tool-showQuiz",
        toolCallId: "c",
        state: "output-error",
        errorText: "invalid",
      },
    ];
    const out = assistantMessageForDb({
      id: "m9",
      role: "assistant",
      parts,
    } as never);
    expect(out.parts).toEqual(parts);
  });
});

describe("hasPersistableStudyPart", () => {
  it("is true for a completed (output-available) study part", () => {
    expect(
      hasPersistableStudyPart([
        {
          type: "tool-showQuiz",
          toolCallId: "c",
          state: "output-available",
          output: "rendered",
          input: {},
        },
      ] as never),
    ).toBe(true);
  });

  it("is false for a part stuck mid-input (ghost row from a timeout)", () => {
    // input-streaming never renders; persisting it writes an invisible row.
    expect(
      hasPersistableStudyPart([
        { type: "tool-showQuiz", toolCallId: "c", state: "input-streaming" },
      ] as never),
    ).toBe(false);
  });

  it("is false for an errored study part and for text-only parts", () => {
    expect(
      hasPersistableStudyPart([
        { type: "tool-showQuiz", toolCallId: "c", state: "output-error" },
      ] as never),
    ).toBe(false);
    expect(
      hasPersistableStudyPart([{ type: "text", text: "hi" }] as never),
    ).toBe(false);
  });
});

describe("stripToolPartsForTextModel", () => {
  it("down-converts a completed quiz part to a text placeholder", () => {
    const msg = stripToolPartsForTextModel({
      id: "m10",
      role: "assistant",
      parts: [
        { type: "text", text: "Here's a quiz:" },
        {
          type: "tool-showQuiz",
          toolCallId: "c",
          state: "output-available",
          output: "rendered",
          input: { quiz_title: "Photosynthesis", questions: [] },
        },
      ],
    } as never);
    expect(msg.parts).toEqual([
      { type: "text", text: "Here's a quiz:" },
      { type: "text", text: "[Interactive quiz: Photosynthesis]" },
    ]);
  });

  it("never leaves a message with zero parts (quiz-only turn)", () => {
    const msg = stripToolPartsForTextModel({
      id: "m11",
      role: "assistant",
      parts: [
        {
          type: "tool-showQuiz",
          toolCallId: "c",
          state: "output-available",
          output: "rendered",
          input: { quiz_title: "Cells", questions: [] },
        },
      ],
    } as never);
    expect(msg.parts).toEqual([
      { type: "text", text: "[Interactive quiz: Cells]" },
    ]);
  });

  it("leaves a plain text message unchanged", () => {
    const parts = [{ type: "text", text: "just text" }];
    const msg = stripToolPartsForTextModel({
      id: "m12",
      role: "assistant",
      parts,
    } as never);
    expect(msg.parts).toEqual(parts);
  });
});

/**
 * A turn that ended mid-quiz -- a Stop, a disconnect, or the token limit --
 * leaves the part in `input-streaming`. Stored as-is that is the "Building your
 * quiz..." skeleton, which `hasPersistableStudyPart` treats as unrenderable, so
 * the turn either spins forever in history or is dropped from it entirely.
 */
describe("assistantMessageForDb: an unfinished quiz part", () => {
  const partialInput = {
    quiz_title: "Gender Theory and Barbie",
    questions: [
      {
        question: "What does Butler argue about sex assignment?",
        options: ["Gender precedes it", "It precedes gender"],
        correct_index: 0,
        explanation: "Gender is the scheme within which sex is assigned.",
      },
      // Cut off mid-write: no options, no answer key.
      { question: "What does Barbie stage" },
    ],
  };

  const messageWith = (part: unknown) =>
    ({ id: "m20", role: "assistant", parts: [part] }) as never;

  it("repairs a repairable input-streaming quiz into a persistable part", () => {
    const { parts } = assistantMessageForDb(
      messageWith({
        type: "tool-showQuiz",
        toolCallId: "c1",
        state: "input-streaming",
        input: partialInput,
      }),
    );
    const part = parts[0] as unknown as {
      state: string;
      output: string;
      input: { questions: unknown[] };
    };
    expect(part.state).toBe("output-available");
    expect(part.output).toBe("rendered");
    // The question that finished survives; the truncated one is dropped.
    expect(part.input.questions).toHaveLength(1);
    expect(hasPersistableStudyPart(parts)).toBe(true);
  });

  it("leaves an unsalvageable input-streaming quiz non-persistable", () => {
    const { parts } = assistantMessageForDb(
      messageWith({
        type: "tool-showQuiz",
        toolCallId: "c2",
        state: "input-streaming",
        input: { quiz_title: "Gender Theory" },
      }),
    );
    expect((parts[0] as unknown as { state: string }).state).toBe(
      "input-streaming",
    );
    expect(hasPersistableStudyPart(parts)).toBe(false);
  });

  it("leaves an output-error part alone so history matches what was shown", () => {
    const part = {
      type: "tool-showQuiz",
      toolCallId: "c3",
      state: "output-error",
      errorText: "Couldn't build the quiz",
      input: partialInput,
    };
    const { parts } = assistantMessageForDb(messageWith(part));
    expect(parts[0]).toEqual(part);
    expect(hasPersistableStudyPart(parts)).toBe(false);
  });
});
