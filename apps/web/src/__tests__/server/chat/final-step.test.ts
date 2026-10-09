import { describe, it, expect } from "@jest/globals";
import { tool } from "ai";
import { z } from "zod";
import {
  cutOffMidSearch,
  finalStepSettings,
  MAX_AGENT_STEPS,
  primaryTurnFailed,
} from "@/server/chat/final-step";
import { studyTools } from "@/server/chat/study-tools";

const searchTool = tool({
  description: "search",
  inputSchema: z.object({ query: z.string() }),
  execute: async () => [],
});

describe("finalStepSettings", () => {
  const tools = { search_documents: searchTool, ...studyTools };

  it("leaves every step before the last alone", () => {
    for (let step = 0; step < MAX_AGENT_STEPS - 1; step++) {
      expect(finalStepSettings(tools, "sys", step)).toBeUndefined();
    }
  });

  it("drops the retrieval tools and says why on the last step", () => {
    const settings = finalStepSettings(tools, "sys", MAX_AGENT_STEPS - 1);
    expect(settings?.activeTools).toEqual(["showQuiz"]);
    expect(settings?.system.startsWith("sys")).toBe(true);
    expect(settings?.system).toContain("could not find it");
  });

  it("is a no-op for a turn without retrieval tools", () => {
    expect(
      finalStepSettings(studyTools, "sys", MAX_AGENT_STEPS - 1),
    ).toBeUndefined();
  });
});

type TurnEnd = Parameters<typeof cutOffMidSearch>[0];
type LastStep = NonNullable<TurnEnd["lastStep"]>;
type Tail = TurnEnd["tail"];

const step = (overrides: Partial<LastStep> = {}): LastStep => ({
  toolCalls: [],
  text: "",
  finishReason: "stop",
  ...overrides,
});
const calling = (...names: string[]) => names.map((toolName) => ({ toolName }));
/** A stream whose last step finished cleanly with `text`. */
const tail = (overrides: Partial<Tail> = {}): Tail => ({
  errorAfterLastStep: false,
  stepText: "",
  stepStartedSearch: false,
  stepFinished: true,
  shownStudyTool: false,
  ...overrides,
});
const ended = (
  lastStep: LastStep | undefined,
  overrides: { tail?: Partial<Tail>; streamFailed?: boolean } = {},
): TurnEnd => ({
  lastStep,
  tail: tail({ stepText: lastStep?.text ?? "", ...overrides.tail }),
  streamFailed: overrides.streamFailed ?? false,
});

describe("primaryTurnFailed", () => {
  it("is false for a turn that got past an error chunk and finished", () => {
    const end = ended(step({ text: "An answer." }), {
      tail: { errorText: "boom" },
    });
    expect(primaryTurnFailed(end)).toBe(false);
  });

  it("is true when the last step failed, a later request failed, or the stream broke", () => {
    expect(primaryTurnFailed(ended(step({ finishReason: "error" })))).toBe(
      true,
    );
    const searched = step({ toolCalls: calling("search_documents") });
    expect(
      primaryTurnFailed(
        ended(searched, { tail: { errorAfterLastStep: true } }),
      ),
    ).toBe(true);
    expect(primaryTurnFailed(ended(undefined, { streamFailed: true }))).toBe(
      true,
    );
  });
});

describe("primaryTurnFailed after the last step", () => {
  it("ignores an error after a step that answered and left nothing to read", () => {
    // No further request was coming, so the clean step is the answer.
    const answered = step({ text: "An answer." });
    expect(
      primaryTurnFailed(
        ended(answered, { tail: { errorAfterLastStep: true } }),
      ),
    ).toBe(false);
    expect(
      cutOffMidSearch(ended(answered, { tail: { errorAfterLastStep: true } })),
    ).toBe(false);
  });
});

describe("cutOffMidSearch", () => {
  it("is false for a step that answered", () => {
    expect(cutOffMidSearch(ended(step({ text: "An answer." })))).toBe(false);
  });

  it("is true when the last step searched and nothing read the result", () => {
    const last = step({
      text: "Let me search.",
      toolCalls: calling("search_documents"),
      finishReason: "tool-calls",
    });
    expect(cutOffMidSearch(ended(last))).toBe(true);
  });

  it("reads the tool calls, not a `stop` finish reason reported beside them", () => {
    expect(
      cutOffMidSearch(ended(step({ toolCalls: calling("get_page") }))),
    ).toBe(true);
  });

  it("counts a call to a tool that does not exist, whose error went unread", () => {
    expect(
      cutOffMidSearch(ended(step({ toolCalls: calling("web_search") }))),
    ).toBe(true);
  });

  it("is false for the tools that end a turn by design", () => {
    expect(cutOffMidSearch(ended(step({ toolCalls: calling("done") })))).toBe(
      false,
    );
    expect(
      cutOffMidSearch(ended(step({ toolCalls: calling("showQuiz") }))),
    ).toBe(false);
  });

  it("is true when the last step began a search that never became a call", () => {
    const end = ended(step({ text: "Let me search." }), {
      tail: { stepStartedSearch: true },
    });
    expect(cutOffMidSearch(end)).toBe(true);
  });

  it("ignores an earlier error the loop got past", () => {
    // Answered, searched, then read the result and said nothing more.
    const end = ended(step(), { tail: { errorText: "boom" } });
    expect(cutOffMidSearch(end)).toBe(false);
  });

  it("is true when the failing step wrote nothing, or failed before it started", () => {
    expect(cutOffMidSearch(ended(step({ finishReason: "error" })))).toBe(true);
    const answeredThenRejected = ended(
      step({ text: "An answer.", toolCalls: calling("search_documents") }),
      { tail: { errorAfterLastStep: true } },
    );
    expect(cutOffMidSearch(answeredThenRejected)).toBe(true);
  });

  it("is true when the failing step had started another search", () => {
    const end = ended(
      step({ text: "Let me search again.", finishReason: "error" }),
      { tail: { stepStartedSearch: true } },
    );
    expect(cutOffMidSearch(end)).toBe(true);
  });

  it("is false when the failing step wrote a partial answer", () => {
    expect(
      cutOffMidSearch(
        ended(step({ text: "The unit of analysis is", finishReason: "error" })),
      ),
    ).toBe(false);
    const dropped = ended(undefined, {
      streamFailed: true,
      tail: { stepText: "The unit of analysis is", stepFinished: false },
    });
    expect(cutOffMidSearch(dropped)).toBe(false);
  });

  it("treats a step that answered as the answer when the connection drops after it", () => {
    const dropped = ended(undefined, {
      streamFailed: true,
      tail: { stepText: "A full answer.", stepFinished: true },
    });
    expect(cutOffMidSearch(dropped)).toBe(false);
  });

  it("is true when the connection drops after a step that searched", () => {
    const dropped = ended(undefined, {
      streamFailed: true,
      tail: {
        stepText: "Let me search.",
        stepStartedSearch: true,
        stepFinished: true,
      },
    });
    expect(cutOffMidSearch(dropped)).toBe(true);
  });

  it("treats a step that answered as the answer when an error after it breaks the stream", () => {
    // The error came after the step finished, but a step that answered
    // without searching ended the turn there: no request was cut off.
    const dropped = ended(undefined, {
      streamFailed: true,
      tail: {
        errorAfterLastStep: true,
        stepText: "A full answer.",
        stepFinished: true,
      },
    });
    expect(cutOffMidSearch(dropped)).toBe(false);
  });

  it("is false when a quiz already reached the student before the stream broke", () => {
    const dropped = ended(undefined, {
      streamFailed: true,
      tail: { shownStudyTool: true, stepFinished: false },
    });
    expect(cutOffMidSearch(dropped)).toBe(false);
  });

  it("is true when the connection dropped before the step wrote anything", () => {
    const dropped = ended(undefined, {
      streamFailed: true,
      tail: { stepFinished: false },
    });
    expect(cutOffMidSearch(dropped)).toBe(true);
  });
});
