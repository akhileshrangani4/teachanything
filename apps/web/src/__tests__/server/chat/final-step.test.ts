import { describe, it, expect } from "@jest/globals";
import { tool } from "ai";
import { z } from "zod";
import {
  cutOffMidSearch,
  finalStepSettings,
  MAX_AGENT_STEPS,
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

type LastStep = NonNullable<Parameters<typeof cutOffMidSearch>[0]>;

describe("cutOffMidSearch", () => {
  const step = (overrides: Partial<LastStep> = {}): LastStep => ({
    toolCalls: [],
    text: "",
    finishReason: "stop",
    ...overrides,
  });
  const calling = (...names: string[]) =>
    names.map((toolName) => ({ toolName }));

  it("is false for a step that answered", () => {
    expect(cutOffMidSearch(step({ text: "An answer." }), false)).toBe(false);
  });

  it("is true when the last step searched and nothing read the result", () => {
    const last = step({
      text: "Let me search.",
      toolCalls: calling("search_documents"),
      finishReason: "tool-calls",
    });
    expect(cutOffMidSearch(last, false)).toBe(true);
  });

  it("reads the tool calls, not a `stop` finish reason reported beside them", () => {
    const last = step({ toolCalls: calling("get_page") });
    expect(cutOffMidSearch(last, false)).toBe(true);
  });

  it("counts a call to a tool that does not exist, whose error went unread", () => {
    expect(
      cutOffMidSearch(step({ toolCalls: calling("web_search") }), false),
    ).toBe(true);
  });

  it("is false for the tools that end a turn by design", () => {
    expect(cutOffMidSearch(step({ toolCalls: calling("done") }), false)).toBe(
      false,
    );
    expect(
      cutOffMidSearch(step({ toolCalls: calling("showQuiz") }), false),
    ).toBe(false);
  });

  it("is true when the stream failed before the last step wrote anything", () => {
    expect(cutOffMidSearch(step(), true)).toBe(true);
    expect(cutOffMidSearch(step({ finishReason: "error" }), false)).toBe(true);
  });

  it("is false when the last step wrote a partial answer before failing", () => {
    const last = step({
      text: "The unit of analysis is",
      finishReason: "error",
    });
    expect(cutOffMidSearch(last, true)).toBe(false);
  });

  it("is false when there is no step to judge", () => {
    expect(cutOffMidSearch(undefined, true)).toBe(false);
  });
});
