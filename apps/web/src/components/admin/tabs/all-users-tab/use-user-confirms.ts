"use client";

import type { useUserActions } from "../../hooks/useUserActions";
import type { useUserDialogs } from "../../hooks/useUserDialogs";

type UserActions = ReturnType<typeof useUserActions>;
type UserDialogs = ReturnType<typeof useUserDialogs>;

// Confirm handlers wiring each action dialog to its tRPC mutation.
export function useUserConfirms({
  userActions,
  dialogs,
  closers,
}: {
  userActions: UserActions;
  dialogs: UserDialogs["dialogs"];
  closers: UserDialogs["closers"];
}) {
  const confirmPromote = async () => {
    if (!dialogs.promote.userId) return;
    await userActions.promoteToAdmin.mutateAsync({
      userId: dialogs.promote.userId,
    });
    closers.closePromote();
  };

  const confirmDemote = async () => {
    if (!dialogs.demote.userId) return;
    await userActions.demoteFromAdmin.mutateAsync({
      userId: dialogs.demote.userId,
    });
    closers.closeDemote();
  };

  const confirmDisable = async () => {
    if (!dialogs.disable.userId) return;
    await userActions.disableUser.mutateAsync({
      userId: dialogs.disable.userId,
    });
    closers.closeDisable();
  };

  const confirmEnable = async () => {
    if (!dialogs.enable.userId) return;
    await userActions.enableUser.mutateAsync({
      userId: dialogs.enable.userId,
    });
    closers.closeEnable();
  };

  const confirmDelete = async () => {
    if (!dialogs.delete.userId) return;
    await userActions.deleteUser.mutateAsync({
      userId: dialogs.delete.userId,
    });
    closers.closeDelete();
  };

  return {
    confirmPromote,
    confirmDemote,
    confirmDisable,
    confirmEnable,
    confirmDelete,
  };
}
