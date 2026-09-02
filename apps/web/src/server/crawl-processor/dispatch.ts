import { logInfo, logError } from "@/lib/logger";
import { publishQStashJob } from "../qstash";
import { env } from "@/lib/env";

/**
 * Dispatch a crawl job: runs inline in development, publishes to QStash in production.
 * Fire-and-forget in dev to match production's QStash semantics (QStash returns
 * immediately after queueing). This keeps UI mutations responsive -- the caller
 * returns right away and the crawl progresses in the background.
 */
export async function dispatchCrawlJob(opts: {
  jobPath: string;
  body: Record<string, string>;
  inlineFn: () => Promise<void>;
  label: string;
}): Promise<void> {
  if (env.NODE_ENV === "development") {
    logInfo(`${opts.label} inline (development mode)`, opts.body);
    // Fire-and-forget: don't await, match QStash queue semantics
    void opts.inlineFn().catch((error) => {
      logError(error, `Inline ${opts.label} failed`, opts.body);
    });
  } else {
    await publishQStashJob({
      url: `${env.NEXT_PUBLIC_APP_URL}${opts.jobPath}`,
      body: opts.body,
    });
    logInfo(`${opts.label} job published`, opts.body);
  }
}
