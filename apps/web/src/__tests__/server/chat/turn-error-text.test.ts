import { describe, it, expect } from "@jest/globals";
import { createTurnErrorText } from "@/server/chat/turn-error-text";

const BUDGET = new Error(
  "API key budget limit exceeded (monthly limit). Contact your org admin.",
);
const CODED = JSON.stringify({ code: "service_unavailable" });
const GENERIC = "Failed to generate a response. Please try again.";

describe("createTurnErrorText", () => {
  it("gives an ordinary failure the generic text", () => {
    expect(createTurnErrorText()(new Error("socket hang up"))).toBe(GENERIC);
  });

  it("keeps the budget code for errors after the budget one in the same turn", () => {
    const errorText = createTurnErrorText();
    expect(errorText(BUDGET)).toBe(CODED);
    // The fallback's own failure, which carries no budget wording.
    expect(errorText(new Error("No output generated."))).toBe(CODED);
  });

  it("does not carry the budget code into another turn", () => {
    createTurnErrorText()(BUDGET);
    expect(createTurnErrorText()(new Error("socket hang up"))).toBe(GENERIC);
  });
});
