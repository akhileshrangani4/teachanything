/**
 * useMessageRatings: the student's thumbs show optimistically, block a second
 * save while one is in flight, and roll back with a toast when the save fails.
 */
import { jest, describe, it, expect } from "@jest/globals";
import { act, renderHook } from "@testing-library/react";
import type { SubmitMessageRatingInput } from "@/lib/submit-message-rating";

const mockSubmit =
  jest.fn<(input: SubmitMessageRatingInput) => Promise<boolean>>();
const mockToastError = jest.fn();

jest.unstable_mockModule("@/lib/submit-message-rating", () => ({
  submitMessageRating: mockSubmit,
}));
// One `t` across renders, as react-i18next gives while the language is fixed.
const mockT = (key: string) => key;
jest.unstable_mockModule("react-i18next", () => ({
  useTranslation: () => ({ t: mockT }),
}));
jest.unstable_mockModule("sonner", () => ({
  toast: { error: mockToastError },
}));

const { useMessageRatings, withMessageRating } =
  await import("@/hooks/use-message-ratings");

const MESSAGE_ID = "aaaaaaaa-0000-4000-8000-000000000001";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function renderRatings() {
  return renderHook(() => useMessageRatings("share-token", "session-1"));
}

describe("useMessageRatings", () => {
  it("shows the rating while saving, then keeps it once saved", async () => {
    const save = deferred<boolean>();
    mockSubmit.mockReturnValueOnce(save.promise);
    const { result } = renderRatings();

    act(() => result.current.rateMessage(MESSAGE_ID, "up"));
    expect(result.current.ratings[MESSAGE_ID]).toEqual({
      value: "up",
      isSaving: true,
    });
    expect(mockSubmit).toHaveBeenCalledWith({
      shareToken: "share-token",
      sessionId: "session-1",
      messageId: MESSAGE_ID,
      rating: "up",
    });

    await act(async () => save.resolve(true));
    expect(result.current.ratings[MESSAGE_ID]).toEqual({
      value: "up",
      isSaving: false,
    });
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it("ignores a second rating while the first is still saving", () => {
    mockSubmit.mockReturnValueOnce(new Promise(() => {}));
    const { result } = renderRatings();

    act(() => result.current.rateMessage(MESSAGE_ID, "up"));
    act(() => result.current.rateMessage(MESSAGE_ID, "down"));

    expect(mockSubmit).toHaveBeenCalledTimes(1);
    expect(result.current.ratings[MESSAGE_ID]?.value).toBe("up");
  });

  it("rolls back to the previous rating and toasts when a re-rate fails", async () => {
    mockSubmit.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const { result } = renderRatings();

    await act(async () => result.current.rateMessage(MESSAGE_ID, "up"));
    await act(async () => result.current.rateMessage(MESSAGE_ID, "down"));

    expect(result.current.ratings[MESSAGE_ID]).toEqual({
      value: "up",
      isSaving: false,
    });
    expect(mockToastError).toHaveBeenCalledWith("chat.message.rating.failed");
  });

  it("rolls back to unrated when the first rating fails", async () => {
    mockSubmit.mockResolvedValueOnce(false);
    const { result } = renderRatings();

    await act(async () => result.current.rateMessage(MESSAGE_ID, "down"));

    expect(result.current.ratings[MESSAGE_ID]).toEqual({
      value: null,
      isSaving: false,
    });
  });

  it("keeps rateMessage stable across ratings and clears on reset", async () => {
    mockSubmit.mockResolvedValueOnce(true);
    const { result } = renderRatings();
    const firstRate = result.current.rateMessage;

    await act(async () => result.current.rateMessage(MESSAGE_ID, "up"));
    expect(result.current.rateMessage).toBe(firstRate);

    act(() => result.current.resetRatings());
    expect(result.current.ratings).toEqual({});
  });
});

describe("withMessageRating", () => {
  it("sets one message without touching the others or the input", () => {
    const before = { other: { value: "down" as const, isSaving: false } };
    const after = withMessageRating(before, MESSAGE_ID, {
      value: "up",
      isSaving: true,
    });

    expect(after).toEqual({
      other: { value: "down", isSaving: false },
      [MESSAGE_ID]: { value: "up", isSaving: true },
    });
    expect(before).toEqual({ other: { value: "down", isSaving: false } });
  });
});
