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

/**
 * Persist a completed study-tool response to the capture endpoint. Fire-and-
 * forget: a failed save must never block the student's UI (the response still
 * renders and stays in the in-session store for export), so a non-2xx or
 * network error is logged and swallowed.
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
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      logError(
        new Error(`study-response ${res.status}`),
        "Failed to persist study-tool response",
      );
    }
  } catch (err) {
    logError(err, "Failed to persist study-tool response");
  }
}
