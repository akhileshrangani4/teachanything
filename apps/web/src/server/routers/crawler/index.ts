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
import { renameCrawlSourceProcedure } from "./procedures/rename-crawl-source";
import { renameCrawledPageProcedure } from "./procedures/rename-crawled-page";
import { getAllCrawlSourcesProcedure } from "./procedures/get-all-crawl-sources";
import { attachToChatbotProcedure } from "./procedures/attach-to-chatbot";
import { detachFromChatbotProcedure } from "./procedures/detach-from-chatbot";
import { getAttachableSourcesProcedure } from "./procedures/get-attachable-sources";

export const crawlerRouter = router({
  addCrawlSource: addCrawlSourceProcedure,
  addManualUrl: addManualUrlProcedure,
  getAllCrawlSources: getAllCrawlSourcesProcedure,
  getCrawlSources: getCrawlSourcesProcedure,
  getCrawledPages: getCrawledPagesProcedure,
  renameCrawlSource: renameCrawlSourceProcedure,
  renameCrawledPage: renameCrawledPageProcedure,
  removeCrawlSource: removeCrawlSourceProcedure,
  removeCrawledPage: removeCrawledPageProcedure,
  recrawl: recrawlProcedure,
  exportJson: exportJsonProcedure,
  toggleCrawlSource: toggleCrawlSourceProcedure,
  attachToChatbot: attachToChatbotProcedure,
  detachFromChatbot: detachFromChatbotProcedure,
  getAttachableSources: getAttachableSourcesProcedure,
});
