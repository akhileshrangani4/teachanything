import { isOutOfCreditsError } from "@teachanything/ai/error-utils";

const GENERIC_ERROR = "Failed to generate a response. Please try again.";
const OUT_OF_CREDITS_ERROR = JSON.stringify({ code: "service_unavailable" });

/**
 * The student-facing text for each error in one chat turn.
 *
 * Once the turn has hit a spent AI budget, every later error in it gets the
 * same coded text. Otherwise the empty-response fallback, which fails right
 * after with a generic "no output" error, would send "Failed to generate a
 * response" on top of the budget notice. The coded body is translated on the
 * client (see describeChatError).
 */
export function createTurnErrorText(): (error: unknown) => string {
  let isOutOfCredits = false;
  return (error) => {
    if (isOutOfCreditsError(error)) isOutOfCredits = true;
    return isOutOfCredits ? OUT_OF_CREDITS_ERROR : GENERIC_ERROR;
  };
}
