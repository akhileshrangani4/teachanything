import { router } from "@/server/trpc";
import { getPendingUsersProcedure } from "./procedures/users";
import { approveUserProcedure } from "./procedures/users";
import { rejectUserProcedure } from "./procedures/users";
import { getAllUsersProcedure } from "./procedures/users";
import { getUserStatsProcedure } from "./procedures/users";
import { promoteToAdminProcedure } from "./procedures/user-status";
import { demoteFromAdminProcedure } from "./procedures/user-status";
import { disableUserProcedure } from "./procedures/user-status";
import { enableUserProcedure } from "./procedures/user-status";
import { deleteUserProcedure } from "./procedures/user-status";
import { listDomainsProcedure } from "./procedures/domains";
import { getEnvDomainsProcedure } from "./procedures/domains";
import { addDomainProcedure } from "./procedures/domains";
import { removeDomainProcedure } from "./procedures/domains";
import { getAllChatbotsProcedure } from "./procedures/chatbots";
import { toggleFeaturedProcedure } from "./procedures/chatbots";
import { updateAuthorNameProcedure } from "./procedures/chatbots";
import { deleteChatbotProcedure } from "./procedures/chatbots";
import { getAllConversationsProcedure } from "./procedures/conversations";
import { exportAdminDataProcedure } from "./procedures/export-data";

export const adminRouter = router({
  getPendingUsers: getPendingUsersProcedure,
  approveUser: approveUserProcedure,
  rejectUser: rejectUserProcedure,
  listDomains: listDomainsProcedure,
  getEnvDomains: getEnvDomainsProcedure,
  addDomain: addDomainProcedure,
  removeDomain: removeDomainProcedure,
  getAllChatbots: getAllChatbotsProcedure,
  toggleFeatured: toggleFeaturedProcedure,
  updateAuthorName: updateAuthorNameProcedure,
  deleteChatbot: deleteChatbotProcedure,
  getAllConversations: getAllConversationsProcedure,
  getAllUsers: getAllUsersProcedure,
  getUserStats: getUserStatsProcedure,
  promoteToAdmin: promoteToAdminProcedure,
  demoteFromAdmin: demoteFromAdminProcedure,
  disableUser: disableUserProcedure,
  enableUser: enableUserProcedure,
  exportAdminData: exportAdminDataProcedure,
  deleteUser: deleteUserProcedure,
});
