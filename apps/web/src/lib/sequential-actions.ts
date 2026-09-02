import { logError } from "@/lib/logger";

/**
 * Runs `action` sequentially for each id. Per-item failures are logged via
 * logError (with `describeFailure(id)` as context) and counted instead of
 * aborting the loop. Returns the number of failed items.
 */
export async function runSequentially(
  ids: readonly string[],
  action: (id: string) => Promise<unknown>,
  describeFailure: (id: string) => string,
): Promise<number> {
  let failures = 0;
  for (const id of ids) {
    try {
      await action(id);
    } catch (error) {
      failures++;
      logError(error, describeFailure(id));
    }
  }
  return failures;
}
