"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { trpc } from "@/lib/trpc";
import { Clock } from "lucide-react";
import { PaginationControls } from "../../dashboard/files/PaginationControls";
import {
  TableToolbar,
  SortableTableHead,
  type PendingUserSortBy,
} from "@/components/data-table";
import { useServerTable } from "@/hooks/useServerTable";
import { StatsHeader } from "../components/StatsHeader";
import { useUserStats } from "../hooks/useUserStats";
import type { UserDetailsDialogState } from "../types/user-details";
import { useState, useCallback } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/ui/skeletons";
import { usePendingUsersActions } from "./pending-users-tab/use-pending-users-actions";
import { PendingUserRow } from "./pending-users-tab/pending-user-row";
import { PendingUsersDialogs } from "./pending-users-tab/pending-users-dialogs";
import { EMPTY_USER_DIALOG, type PendingUser } from "./pending-users-tab/types";

const ITEMS_PER_PAGE = 10;

export function PendingUsersTab() {
  const { state, searchInput, actions, queryParams } =
    useServerTable<PendingUserSortBy>(
      { defaultSortBy: "createdAt", defaultSortDir: "desc" },
      ITEMS_PER_PAGE,
    );

  const [detailsDialog, setDetailsDialog] = useState<UserDetailsDialogState>({
    isOpen: false,
    user: null,
  });

  const {
    data: pendingUsersData,
    isLoading: usersLoading,
    isFetching,
    refetch,
  } = trpc.admin.getPendingUsers.useQuery(
    {
      limit: ITEMS_PER_PAGE,
      ...queryParams,
    },
    {
      placeholderData: keepPreviousData,
    },
  );

  const { data: stats, refetch: refetchStats } = useUserStats();

  const pendingUsers = pendingUsersData?.users || [];
  const totalCount = pendingUsersData?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const {
    approveDialog,
    setApproveDialog,
    rejectDialog,
    setRejectDialog,
    isApproving,
    isRejecting,
    approveError,
    rejectError,
    handleApprove,
    handleReject,
    confirmApprove,
    confirmReject,
  } = usePendingUsersActions({
    totalCount,
    currentPage: state.page,
    setPage: actions.setPage,
    refetchUsers: refetch,
    refetchStats,
  });

  const openUserDetails = useCallback(
    (user: PendingUser) => {
      setDetailsDialog({
        isOpen: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          title: user.title,
          institutionalAffiliation: user.institutionalAffiliation,
          department: user.department,
          facultyWebpage: user.facultyWebpage,
          country: user.country,
          status: user.status,
          createdAt: user.createdAt,
        },
      });
    },
    [setDetailsDialog],
  );

  return (
    <>
      <Card>
        <CardHeader className="pb-4">
          <StatsHeader
            title="Pending User Approvals"
            description="Review and approve user registrations"
            stats={
              stats
                ? [
                    { value: stats.pending, label: "Pending" },
                    {
                      value: stats.total,
                      label: "Total Users",
                      highlight: true,
                    },
                  ]
                : undefined
            }
          />
        </CardHeader>
        <CardContent>
          {approveError && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{approveError.message}</AlertDescription>
            </Alert>
          )}
          {rejectError && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{rejectError.message}</AlertDescription>
            </Alert>
          )}

          <TableToolbar
            searchValue={searchInput}
            onSearchChange={actions.setSearch}
            placeholder="Search pending users by name or email..."
            totalCount={totalCount}
            visibleCount={pendingUsers.length}
            itemLabel="pending user"
            isLoading={isFetching && !usersLoading}
          />

          {usersLoading && !pendingUsersData ? (
            <TableSkeleton
              minWidth={600}
              header={
                <>
                  <Skeleton className="h-4 w-14 shrink-0" />
                  <Skeleton className="h-4 w-14 shrink-0" />
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
                  <Skeleton className="h-5 w-16 rounded-full shrink-0" />
                  <Skeleton className="h-4 w-20 shrink-0" />
                  <Skeleton className="h-8 w-20 rounded-md shrink-0 ml-auto" />
                </>
              }
            />
          ) : pendingUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Clock className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
              <p className="text-lg font-medium text-foreground mb-1">
                No pending users
              </p>
              <p className="text-sm text-muted-foreground">
                {state.search || searchInput
                  ? "Try adjusting your search terms"
                  : "All user registrations have been reviewed"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md border overflow-x-auto">
                <Table className="min-w-[600px]">
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
                      <TableHead className="font-semibold">Status</TableHead>
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
                    {pendingUsers.map((user) => (
                      <PendingUserRow
                        key={user.id}
                        user={user}
                        isAnyActionPending={isApproving || isRejecting}
                        onOpenDetails={openUserDetails}
                        onApprove={handleApprove}
                        onReject={handleReject}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
              {totalPages > 1 && (
                <div className="flex justify-center pt-4">
                  <PaginationControls
                    currentPage={state.page}
                    totalPages={totalPages}
                    onPageChange={actions.setPage}
                  />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <PendingUsersDialogs
        approveDialog={approveDialog}
        rejectDialog={rejectDialog}
        detailsDialog={detailsDialog}
        onCloseApprove={() => setApproveDialog(EMPTY_USER_DIALOG)}
        onCloseReject={() => setRejectDialog(EMPTY_USER_DIALOG)}
        onCloseDetails={() => setDetailsDialog({ isOpen: false, user: null })}
        onConfirmApprove={confirmApprove}
        onConfirmReject={confirmReject}
        isApproving={isApproving}
        isRejecting={isRejecting}
      />
    </>
  );
}
