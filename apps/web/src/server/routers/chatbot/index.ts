import { router } from "@/server/trpc";
import { chatbotQueries } from "./queries";
import { chatbotMutations } from "./mutations";

export const chatbotRouter = router({
  ...chatbotQueries,
  ...chatbotMutations,
});
