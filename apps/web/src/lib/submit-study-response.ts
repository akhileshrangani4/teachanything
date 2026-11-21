import { postWithPersistRetry } from "@/lib/post-with-persist-retry";
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

/**
 * Persist a completed study-tool response to the capture endpoint. Fire-and-
 * forget: a failed save must never block the student's UI (the response still
 * renders and stays in the in-session store for export), so a final failure is
 * logged and swallowed. A quiz renders while the stream is still open, so the
 * save can beat the turn's onFinish commit; `postWithPersistRetry` retries
 * that 404 (and network/5xx blips). Re-grading is idempotent server-side
 * (worst case a duplicate attempt row).
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
  await postWithPersistRetry(
    endpoint,
    input,
    "Failed to persist study-tool response",
  );
}
