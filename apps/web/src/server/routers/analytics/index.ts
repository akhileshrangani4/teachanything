import { router } from "@/server/trpc";
import { getChatbotStatsProcedure } from "./procedures/usage";
import { getMessageVolumeProcedure } from "./procedures/usage";
import { getTotalMessagesPerMonthProcedure } from "./procedures/usage";
import { getSessionMetricsProcedure } from "./procedures/sessions";
import { getSessionsOverTimeProcedure } from "./procedures/sessions";
import { getSessionLengthDistributionProcedure } from "./procedures/sessions";
import { getCommonQuestionsProcedure } from "./procedures/insights";
import { getLowConfidenceQueriesProcedure } from "./procedures/insights";
import { getConversationsListProcedure } from "./procedures/conversations";
import { getConversationMessagesProcedure } from "./procedures/conversations";
import { searchConversationsProcedure } from "./procedures/conversations";
import { deleteConversationsProcedure } from "./procedures/conversations";
import { exportConversationsProcedure } from "./procedures/export-conversations";

export const analyticsRouter = router({
  getChatbotStats: getChatbotStatsProcedure,
  getMessageVolume: getMessageVolumeProcedure,
  getSessionMetrics: getSessionMetricsProcedure,
  getSessionsOverTime: getSessionsOverTimeProcedure,
  getSessionLengthDistribution: getSessionLengthDistributionProcedure,
  getCommonQuestions: getCommonQuestionsProcedure,
  getLowConfidenceQueries: getLowConfidenceQueriesProcedure,
  getTotalMessagesPerMonth: getTotalMessagesPerMonthProcedure,
  getConversationsList: getConversationsListProcedure,
  getConversationMessages: getConversationMessagesProcedure,
  searchConversations: searchConversationsProcedure,
  deleteConversations: deleteConversationsProcedure,
  exportConversations: exportConversationsProcedure,
});
