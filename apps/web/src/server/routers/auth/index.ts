import { router } from "@/server/trpc";
import { getStatusProcedure } from "./procedures/status";
import { checkUserStatusProcedure } from "./procedures/status";
import { checkApprovalStatusProcedure } from "./procedures/status";
import { getProfileProcedure } from "./procedures/profile";
import { updateProfileProcedure } from "./procedures/profile";
import { updateNameProcedure } from "./procedures/profile";
import { updatePasswordProcedure } from "./procedures/password";
import { deleteOwnAccountProcedure } from "./procedures/delete-account";

export const authRouter = router({
  getStatus: getStatusProcedure,
  checkUserStatus: checkUserStatusProcedure,
  checkApprovalStatus: checkApprovalStatusProcedure,
  getProfile: getProfileProcedure,
  updateProfile: updateProfileProcedure,
  updateName: updateNameProcedure,
  updatePassword: updatePasswordProcedure,
  deleteOwnAccount: deleteOwnAccountProcedure,
});
