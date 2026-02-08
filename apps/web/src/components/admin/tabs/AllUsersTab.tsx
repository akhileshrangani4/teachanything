"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { Users } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { PaginationControls } from "../../dashboard/files/PaginationControls";
import {
  TableToolbar,
  SortableTableHead,
  type UserSortBy,
} from "@/components/data-table";
import { useServerTable } from "@/hooks/useServerTable";
import { useUserStats } from "../hooks/useUserStats";
import { useUserActions } from "../hooks/useUserActions";
import { useUserDialogs } from "../hooks/useUserDialogs";
import { UserTableRow } from "../components/UserTableRow";
import { StatsHeader } from "../components/StatsHeader";
import { UserActionDialogs } from "../components/UserActionDialogs";
import { MutationErrors } from "../components/MutationErrors";
import { UserDetailsDialog } from "../components/UserDetailsDialog";
import type { UserDetailsDialogState } from "../types/user-details";
import { keepPreviousData } from "@tanstack/react-query";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/ui/skeletons";

const ITEMS_PER_PAGE = 10;

export function AllUsersTab() {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;

  const { state, searchInput, actions, queryParams } =
    useServerTable<UserSortBy>(
      { defaultSortBy: "createdAt", defaultSortDir: "desc" },
      ITEMS_PER_PAGE,
    );

  const {
    data: usersData,
    isLoading: usersLoading,
    isFetching,
    refetch,
  } = trpc.admin.getAllUsers.useQuery(
    {
      limit: ITEMS_PER_PAGE,
      ...queryParams,
    },
    {
      placeholderData: keepPreviousData,
    },
  );

  const { data: stats, refetch: refetchStats } = useUserStats();

  const allUsers = usersData?.users || [];
  const totalCount = usersData?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const userActions = useUserActions({
    refetch,
    refetchStats,
    totalCount,
    currentPage: state.page,
    setCurrentPage: actions.setPage,
    itemsPerPage: ITEMS_PER_PAGE,
  });

  const { dialogs, handlers, closers } = useUserDialogs();

  const [detailsDialog, setDetailsDialog] =
    useState<UserDetailsDialogState>({
      isOpen: false,
      user: null,
    });

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
    await userActions.enableUser.mutateAsync({ userId: dialogs.enable.userId });
    closers.closeEnable();
  };

  const confirmDelete = async () => {
    if (!dialogs.delete.userId) return;
    await userActions.deleteUser.mutateAsync({ userId: dialogs.delete.userId });
    closers.closeDelete();
  };

  const isAnyActionPending =
    userActions.promoteToAdmin.isPending ||
    userActions.demoteFromAdmin.isPending ||
    userActions.disableUser.isPending ||
    userActions.enableUser.isPending ||
    userActions.deleteUser.isPending;

  return (
    <>
      <Card>
        <CardHeader className="pb-4">
          <StatsHeader
            title="All Users"
            description="Manage user roles, permissions, and account status"
            stats={
              stats
                ? [
                    { value: stats.total, label: "Total" },
                    { value: stats.admins, label: "Admins", highlight: true },
                  ]
                : undefined
            }
          />
        </CardHeader>
        <CardContent>
          <MutationErrors
            errors={{
              promote: userActions.promoteToAdmin.error,
              demote: userActions.demoteFromAdmin.error,
              disable: userActions.disableUser.error,
              enable: userActions.enableUser.error,
              delete: userActions.deleteUser.error,
            }}
          />

          <TableToolbar
            searchValue={searchInput}
            onSearchChange={actions.setSearch}
            placeholder="Search users by name or email..."
            totalCount={totalCount}
            visibleCount={allUsers.length}
            itemLabel="user"
            isLoading={isFetching && !usersLoading}
          />

          {usersLoading && !usersData ? (
            <TableSkeleton
              minWidth={700}
              header={
                <>
                  <Skeleton className="h-4 w-14 shrink-0" />
                  <Skeleton className="h-4 w-14 shrink-0" />
                  <Skeleton className="h-4 w-10 shrink-0" />
                  <Skeleton className="h-4 w-14 shrink-0" />
                  <Skeleton className="h-4 w-20 shrink-0" />
                  <Skeleton className="h-4 w-14 shrink-0 ml-auto" />
                </>
              }
              row={
                <>
                  <div className="flex items-center gap-2 shrink-0">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <Skeleton className="h-4 w-32 shrink-0" />
                  <Skeleton className="h-5 w-14 rounded-full shrink-0" />
                  <Skeleton className="h-5 w-20 rounded-full shrink-0" />
                  <Skeleton className="h-4 w-20 shrink-0" />
                  <Skeleton className="h-8 w-20 rounded-md shrink-0 ml-auto" />
                </>
              }
            />
          ) : allUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
              <p className="text-lg font-medium text-foreground mb-1">
                No users found
              </p>
              <p className="text-sm text-muted-foreground">
                {state.search || searchInput
                  ? "Try adjusting your search terms"
                  : "Users will appear here once they register"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md border overflow-x-auto">
                <Table className="min-w-[700px]">
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <SortableTableHead
                        column="name"
                        currentSortBy={state.sortBy}
                        currentSortDir={state.sortDir}
                        onSort={actions.toggleSort}
                      >
                        User
                      </SortableTableHead>
                      <SortableTableHead
                        column="email"
                        currentSortBy={state.sortBy}
                        currentSortDir={state.sortDir}
                        onSort={actions.toggleSort}
                        className="hidden sm:table-cell"
                      >
                        Email
                      </SortableTableHead>
                      <SortableTableHead
                        column="role"
                        currentSortBy={state.sortBy}
                        currentSortDir={state.sortDir}
                        onSort={actions.toggleSort}
                      >
                        Role
                      </SortableTableHead>
                      <SortableTableHead
                        column="status"
                        currentSortBy={state.sortBy}
                        currentSortDir={state.sortDir}
                        onSort={actions.toggleSort}
                      >
                        Status
                      </SortableTableHead>
                      <SortableTableHead
                        column="createdAt"
                        currentSortBy={state.sortBy}
                        currentSortDir={state.sortDir}
                        onSort={actions.toggleSort}
                        className="hidden md:table-cell"
                      >
                        Registered
                      </SortableTableHead>
                      <TableHead className="font-semibold text-right">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allUsers.map((user) => (
                      <UserTableRow
                        key={user.id}
                        user={user}
                        isCurrentUser={user.id === currentUserId}
                        onViewDetails={(u) =>
                          setDetailsDialog({
                            isOpen: true,
                            user: {
                              id: u.id,
                              name: u.name,
                              email: u.email,
                              title: u.title,
                              institutionalAffiliation: u.institutionalAffiliation,
                              department: u.department,
                              facultyWebpage: u.facultyWebpage,
                              country: u.country,
                              status: u.status,
                              createdAt:
                                typeof u.createdAt === "string"
                                  ? new Date(u.createdAt)
                                  : u.createdAt,
                            },
                          })
                        }
                        onPromote={handlers.openPromote}
                        onDemote={handlers.openDemote}
                        onDisable={handlers.openDisable}
                        onEnable={handlers.openEnable}
                        onDelete={handlers.openDelete}
                        isAnyActionPending={isAnyActionPending}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <PaginationControls
                  currentPage={state.page}
                  totalPages={totalPages}
                  onPageChange={actions.setPage}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <UserActionDialogs
        dialogs={dialogs}
        closers={closers}
        onConfirmPromote={confirmPromote}
        onConfirmDemote={confirmDemote}
        onConfirmDisable={confirmDisable}
        onConfirmEnable={confirmEnable}
        onConfirmDelete={confirmDelete}
        isLoading={{
          promote: userActions.promoteToAdmin.isPending,
          demote: userActions.demoteFromAdmin.isPending,
          disable: userActions.disableUser.isPending,
          enable: userActions.enableUser.isPending,
          delete: userActions.deleteUser.isPending,
        }}
      />

      <UserDetailsDialog
        open={detailsDialog.isOpen}
        onOpenChange={(open) =>
          !open && setDetailsDialog({ isOpen: false, user: null })
        }
        user={detailsDialog.user}
      />
    </>
  );
}
