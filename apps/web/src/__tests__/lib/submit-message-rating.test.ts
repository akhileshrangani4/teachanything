/**
 * @jest-environment node
 *
 * submitMessageRating: the thumbs can be clicked before the server's onFinish
 * has persisted the assistant message, so a 404 is retried with backoff.
 */
import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from "@jest/globals";

const mockLogError = jest.fn();
jest.unstable_mockModule("@/lib/logger", () => ({
  logError: mockLogError,
  logWarn: jest.fn(),
  logInfo: jest.fn(),
}));

const { submitMessageRating } = await import("@/lib/submit-message-rating");
const { PERSIST_RETRY_DELAYS_MS } =
  await import("@/lib/post-with-persist-retry");

const INPUT = {
  shareToken: "share-token-1",
  sessionId: "session-aaaaaaaa",
  messageId: "aaaaaaaa-0000-4000-8000-000000000001",
  rating: "up" as const,
};

const mockFetch = jest.fn<typeof fetch>();
const status = (code: number) => new Response(null, { status: code });

/** Run the helper to completion, advancing fake timers through its backoff. */
async function settle(promise: Promise<boolean>): Promise<boolean> {
  for (const delay of PERSIST_RETRY_DELAYS_MS) {
    await jest.advanceTimersByTimeAsync(delay);
  }
  return promise;
}

beforeEach(() => {
  jest.useFakeTimers();
  mockFetch.mockReset();
  mockLogError.mockReset();
  global.fetch = mockFetch;
});

afterEach(() => {
  jest.useRealTimers();
});

describe("submitMessageRating", () => {
  it("posts the rating to the shared endpoint", async () => {
    mockFetch.mockResolvedValueOnce(status(204));

    await expect(submitMessageRating(INPUT)).resolves.toBe(true);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).toBe("/api/message-rating/shared");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual(INPUT);
  });

  it("retries a 404 from the onFinish race until the message persists", async () => {
    mockFetch
      .mockResolvedValueOnce(status(404))
      .mockResolvedValueOnce(status(204));

    const saved = await settle(submitMessageRating(INPUT));

    expect(saved).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockLogError).not.toHaveBeenCalled();
  });

  it("waits out the backoff before retrying", async () => {
    mockFetch
      .mockResolvedValueOnce(status(404))
      .mockResolvedValueOnce(status(204));

    const pending = submitMessageRating(INPUT);
    await jest.advanceTimersByTimeAsync(PERSIST_RETRY_DELAYS_MS[0]! - 1);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    await expect(pending).resolves.toBe(true);
  });

  it("gives up after the bounded retries, logs once and resolves false", async () => {
    mockFetch.mockResolvedValue(status(404));

    const saved = await settle(submitMessageRating(INPUT));

    expect(saved).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(PERSIST_RETRY_DELAYS_MS.length + 1);
    expect(mockLogError).toHaveBeenCalledTimes(1);
  });

  it("does not retry a rate limit", async () => {
    mockFetch.mockResolvedValueOnce(status(429));

    const saved = await settle(submitMessageRating(INPUT));

    expect(saved).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockLogError).toHaveBeenCalledTimes(1);
  });

  it("retries a network failure", async () => {
    mockFetch
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(status(204));

    const saved = await settle(submitMessageRating(INPUT));

    expect(saved).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
