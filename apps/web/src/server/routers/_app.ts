import { router } from "../trpc";
import { authRouter } from "./auth";
import { chatbotRouter } from "./chatbot";
import { filesRouter } from "./files";
import { analyticsRouter } from "./analytics";
import { adminRouter } from "./admin";
import { crawlerRouter } from "./crawler";

export const appRouter = router({
  auth: authRouter,
  chatbot: chatbotRouter,
  files: filesRouter,
  analytics: analyticsRouter,
  admin: adminRouter,
  crawler: crawlerRouter,
});

export type AppRouter = typeof appRouter;
