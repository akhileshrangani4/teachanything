import { jest, describe, it, expect } from "@jest/globals";
import type { SetStateAction } from "react";
import {
  restoreRefusedTurn,
  withdrawRefusedMessage,
} from "@/lib/chat/refused-turn";
import type { StudyUIMessage } from "@/server/chat/study-tools";

const message = (
  id: string,
  role: StudyUIMessage["role"],
  text: string,
): StudyUIMessage => ({ id, role, parts: [{ type: "text", text }] });

const history = [
  message("1", "user", "What is mitosis?"),
  message("2", "assistant", "Cell division."),
];
const refused = message("3", "user", "What is meiosis?");

describe("withdrawRefusedMessage", () => {
  it("drops the refused message when it is last", () => {
    expect(
      withdrawRefusedMessage([...history, refused], "What is meiosis?"),
    ).toEqual(history);
  });

  it.each([
    ["the last message is the assistant's", history, "Cell division."],
    ["the text differs", [...history, refused], "What is mitosis?"],
    ["there are no messages", [], "What is meiosis?"],
  ])("changes nothing when %s", (_case, messages, text) => {
    expect(withdrawRefusedMessage(messages, text)).toBe(messages);
  });
});

/** Apply a state update the way React would, to a starting value. */
function applied<T>(update: SetStateAction<T>, previous: T): T {
  return typeof update === "function"
    ? (update as (prev: T) => T)(previous)
    : update;
}

describe("restoreRefusedTurn", () => {
  const refusal = new Error(JSON.stringify({ code: "turn_in_progress" }));

  it("withdraws the message and hands its text back as the draft", () => {
    const setMessages =
      jest.fn<(u: SetStateAction<StudyUIMessage[]>) => void>();
    const setDraft = jest.fn<(u: SetStateAction<string>) => void>();

    expect(
      restoreRefusedTurn(refusal, "What is meiosis?", setMessages, setDraft),
    ).toBe(true);

    expect(
      applied(setMessages.mock.calls[0]![0], [...history, refused]),
    ).toEqual(history);
    expect(applied(setDraft.mock.calls[0]![0], "")).toBe("What is meiosis?");
  });

  it("keeps a draft typed since the message was sent", () => {
    const setDraft = jest.fn<(u: SetStateAction<string>) => void>();
    restoreRefusedTurn(refusal, "What is meiosis?", () => {}, setDraft);
    expect(applied(setDraft.mock.calls[0]![0], "And respiration?")).toBe(
      "And respiration?",
    );
  });

  it.each([JSON.stringify({ code: "rate_limited" }), "Network down"])(
    "ignores other errors (%s)",
    (body) => {
      const setMessages = jest.fn();
      const setDraft = jest.fn();
      expect(
        restoreRefusedTurn(new Error(body), "x", setMessages, setDraft),
      ).toBe(false);
      expect(setMessages).not.toHaveBeenCalled();
      expect(setDraft).not.toHaveBeenCalled();
    },
  );
});
