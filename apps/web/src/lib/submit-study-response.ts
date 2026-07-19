import { logError } from "@/lib/logger";
import type { QuizResponse } from "@/lib/quiz";

/**
 * A student's response to a study tool, as kept client-side (for export) and
 * sent to the capture endpoint. A discriminated-by-tool union: add each new
 * study component's response type here as it's built. The server derives the
 * tool name from the persisted tool part, so it isn't part of this payload.
 */
export type StudyResponsePayload = QuizResponse; // | FlashcardResponse | ...

type SubmitBase = {
  sessionId: string;
  toolCallId: string;
  response: StudyResponsePayload;
};

/** Retry schedule (ms). See retry rationale in `postStudyResponse`. */
const RETRY_DELAYS_MS = [1500, 3000];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Persist a completed study-tool response to the capture endpoint. Fire-and-
 * forget: a failed save must never block the student's UI (the response still
 * renders and stays in the in-session store for export), so a final failure is
 * logged and swallowed.
 *
 * Bounded retry, because two transient failures are expected in normal use:
 * - 404: the quiz renders (input-available) while the stream is still open, but
 *   the server can only validate the toolCallId after the assistant turn
 *   persists in onFinish -- a fast student on a short quiz can beat that
 *   commit. A short backoff lets the insert land.
 * - network errors / 5xx: ordinary blips; the payload is tiny and re-grading is
 *   idempotent server-side (worst case a duplicate attempt row).
 * 4xx other than 404 (validation, rate limit) are NOT retried.
 */
export async function postStudyResponse(
  input:
    | ({ chatbotId: string } & SubmitBase)
    | ({ shareToken: string } & SubmitBase),
): Promise<void> {
  const endpoint =
    "shareToken" in input
      ? "/api/study-response/shared"
      : "/api/study-response";

  for (let attempt = 0; ; attempt++) {
    let retryable = false;
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (res.ok) return;
      retryable = res.status === 404 || res.status >= 500;
      if (!retryable || attempt >= RETRY_DELAYS_MS.length) {
        logError(
          new Error(`study-response ${res.status}`),
          "Failed to persist study-tool response",
        );
        return;
      }
    } catch (err) {
      // Network-level failure: retryable.
      if (attempt >= RETRY_DELAYS_MS.length) {
        logError(err, "Failed to persist study-tool response");
        return;
      }
      retryable = true;
    }
    if (retryable) await sleep(RETRY_DELAYS_MS[attempt] ?? 3000);
  }
}
