import { router } from "@/server/trpc";
import { addCrawlSourceProcedure } from "./procedures/add-crawl-source";
import { addManualUrlProcedure } from "./procedures/add-manual-url";
import { getCrawlSourcesProcedure } from "./procedures/get-crawl-sources";
import { getCrawledPagesProcedure } from "./procedures/get-crawled-pages";
import { removeCrawlSourceProcedure } from "./procedures/remove-crawl-source";
import { removeCrawledPageProcedure } from "./procedures/remove-crawled-page";
import { recrawlProcedure } from "./procedures/recrawl";
import { exportJsonProcedure } from "./procedures/export-json";
import { toggleCrawlSourceProcedure } from "./procedures/toggle-crawl-source";

export const crawlerRouter = router({
  addCrawlSource: addCrawlSourceProcedure,
  addManualUrl: addManualUrlProcedure,
  getCrawlSources: getCrawlSourcesProcedure,
  getCrawledPages: getCrawledPagesProcedure,
  removeCrawlSource: removeCrawlSourceProcedure,
  removeCrawledPage: removeCrawledPageProcedure,
  recrawl: recrawlProcedure,
  exportJson: exportJsonProcedure,
  toggleCrawlSource: toggleCrawlSourceProcedure,
});
