import { logError } from "@/lib/logger";

type SubmitBase = {
  sessionId: string;
  toolCallId: string;
  answers: number[];
};

/**
 * Persist a completed study-tool attempt to the capture endpoint. Fire-and-
 * forget: a failed save must never block the student's UI (the attempt still
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
      body: JSON.stringify({ ...input, toolName: "showQuiz" }),
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
