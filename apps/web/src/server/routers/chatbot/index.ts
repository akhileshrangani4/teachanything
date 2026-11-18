import { router } from "@/server/trpc";
import { chatbotQueries } from "./queries";
import { chatbotMutations } from "./mutations";
import { getDailyUsageProcedure } from "./daily-usage";

export const chatbotRouter = router({
  ...chatbotQueries,
  ...chatbotMutations,
  getDailyUsage: getDailyUsageProcedure,
});
