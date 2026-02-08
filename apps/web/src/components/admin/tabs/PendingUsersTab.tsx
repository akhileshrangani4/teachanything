"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PaginationControls } from "../../dashboard/files/PaginationControls";
import {
  TableToolbar,
  SortableTableHead,
  type PendingUserSortBy,
} from "@/components/data-table";
import { useServerTable } from "@/hooks/useServerTable";
import { UserAvatarCell, UserEmailCell } from "../components/UserCells";
import { StatsHeader } from "../components/StatsHeader";
import { useUserStats } from "../hooks/useUserStats";
import { UserDetailsDialog } from "../components/UserDetailsDialog";
import type { UserDetailsDialogState } from "../types/user-details";
import { useState, useCallback } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/ui/skeletons";

const ITEMS_PER_PAGE = 10;

type PendingUser = {
  id: string;
  name: string | null;
  email: string;
  title: string | null;
  institutionalAffiliation: string | null;
  department: string | null;
  facultyWebpage: string | null;
  country: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: Date;
};

export function PendingUsersTab() {
  const { state, searchInput, actions, queryParams } =
    useServerTable<PendingUserSortBy>(
      { defaultSortBy: "createdAt", defaultSortDir: "desc" },
      ITEMS_PER_PAGE,
    );

  const [approveDialog, setApproveDialog] = useState<{
    isOpen: boolean;
    userId: string | null;
    userName: string | null;
    userEmail: string | null;
  }>({
    isOpen: false,
    userId: null,
    userName: null,
    userEmail: null,
  });

  const [rejectDialog, setRejectDialog] = useState<{
    isOpen: boolean;
    userId: string | null;
    userName: string | null;
    userEmail: string | null;
  }>({
    isOpen: false,
    userId: null,
    userName: null,
    userEmail: null,
  });

  const [detailsDialog, setDetailsDialog] =
    useState<UserDetailsDialogState>({
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

  const approveUser = trpc.admin.approveUser.useMutation({
    onSuccess: () => {
      // If we're on the last page and it becomes empty after approval, go to previous page
      const newTotalCount = totalCount - 1;
      const newTotalPages = Math.ceil(newTotalCount / ITEMS_PER_PAGE);
      if (state.page >= newTotalPages && state.page > 0) {
        actions.setPage(newTotalPages - 1);
      }
      refetch();
      refetchStats();
      toast.success("User approved successfully", {
        description: "The user has been notified via email",
      });
    },
    onError: (error) => {
      toast.error("Failed to approve user", {
        description: error.message,
      });
    },
  });

  const rejectUser = trpc.admin.rejectUser.useMutation({
    onSuccess: () => {
      // If we're on the last page and it becomes empty after rejection, go to previous page
      const newTotalCount = totalCount - 1;
      const newTotalPages = Math.ceil(newTotalCount / ITEMS_PER_PAGE);
      if (state.page >= newTotalPages && state.page > 0) {
        actions.setPage(newTotalPages - 1);
      }
      refetch();
      refetchStats();
      toast.success("User rejected", {
        description: "The user has been notified via email",
      });
    },
    onError: (error) => {
      toast.error("Failed to reject user", {
        description: error.message,
      });
    },
  });

  const handleApprove = (
    userId: string,
    userName: string,
    userEmail: string,
  ) => {
    setApproveDialog({
      isOpen: true,
      userId,
      userName,
      userEmail,
    });
  };

  const handleReject = (
    userId: string,
    userName: string,
    userEmail: string,
  ) => {
    setRejectDialog({
      isOpen: true,
      userId,
      userName,
      userEmail,
    });
  };

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

  const confirmApprove = async () => {
    if (!approveDialog.userId) return;
    await approveUser.mutateAsync({ userId: approveDialog.userId });
    setApproveDialog({
      isOpen: false,
      userId: null,
      userName: null,
      userEmail: null,
    });
  };

  const confirmReject = async () => {
    if (!rejectDialog.userId) return;
    await rejectUser.mutateAsync({ userId: rejectDialog.userId });
    setRejectDialog({
      isOpen: false,
      userId: null,
      userName: null,
      userEmail: null,
    });
  };

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
          {approveUser.error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{approveUser.error.message}</AlertDescription>
            </Alert>
          )}
          {rejectUser.error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{rejectUser.error.message}</AlertDescription>
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
                      <TableRow
                        key={user.id}
                        className="hover:bg-muted/50 transition-colors"
                      >
                        <TableCell>
                          <UserAvatarCell
                            name={user.name}
                            email={user.email}
                            showEmail={!!user.name}
                          />
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <UserEmailCell email={user.email} />
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className="flex items-center gap-1.5 w-fit font-medium"
                          >
                            <Clock className="h-3.5 w-3.5" />
                            <span className="capitalize">{user.status}</span>
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="text-sm">
                            <p>{new Date(user.createdAt).toLocaleDateString()}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(user.createdAt).toLocaleTimeString()}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {/* Desktop Actions */}
                          <div className="hidden md:flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openUserDetails(user)}
                              className="gap-2"
                            >
                              <Eye className="h-4 w-4" />
                              Details
                            </Button>
                            <Button
                              size="sm"
                              onClick={() =>
                                handleApprove(
                                  user.id,
                                  user.name || "User",
                                  user.email,
                                )
                              }
                              disabled={
                                approveUser.isPending || rejectUser.isPending
                              }
                              className="gap-2"
                            >
                              <CheckCircle className="h-4 w-4" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() =>
                                handleReject(
                                  user.id,
                                  user.name || "User",
                                  user.email,
                                )
                              }
                              disabled={
                                approveUser.isPending || rejectUser.isPending
                              }
                              className="gap-2"
                            >
                              <XCircle className="h-4 w-4" />
                              Reject
                            </Button>
                          </div>
                          {/* Mobile Dropdown Actions */}
                          <div className="md:hidden flex justify-end">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={
                                    approveUser.isPending || rejectUser.isPending
                                  }
                                  aria-label="Open user actions menu"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                side="bottom"
                                className="w-[160px]"
                                sideOffset={5}
                                collisionPadding={16}
                              >
                                <DropdownMenuItem
                                  onClick={() => openUserDetails(user)}
                                  className="cursor-pointer"
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  Details
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleApprove(
                                      user.id,
                                      user.name || "User",
                                      user.email,
                                    )
                                  }
                                  className="cursor-pointer text-green-600"
                                >
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Approve
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleReject(
                                      user.id,
                                      user.name || "User",
                                      user.email,
                                    )
                                  }
                                  className="cursor-pointer text-destructive"
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Reject
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
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

      {/* Approval Confirmation Dialog */}
      <ConfirmationDialog
        open={approveDialog.isOpen}
        onOpenChange={(open) =>
          !open &&
          setApproveDialog({
            isOpen: false,
            userId: null,
            userName: null,
            userEmail: null,
          })
        }
        onConfirm={confirmApprove}
        title="Approve User"
        description={
          <>
            Are you sure you want to approve{" "}
            <strong>{approveDialog.userName}</strong> ({approveDialog.userEmail}
            )? They will be notified via email and granted access to the system.
          </>
        }
        confirmText="Approve"
        variant="default"
        loading={approveUser.isPending}
      />

      {/* Rejection Confirmation Dialog */}
      <ConfirmationDialog
        open={rejectDialog.isOpen}
        onOpenChange={(open) =>
          !open &&
          setRejectDialog({
            isOpen: false,
            userId: null,
            userName: null,
            userEmail: null,
          })
        }
        onConfirm={confirmReject}
        title="Reject User"
        description={
          <>
            Are you sure you want to reject{" "}
            <strong>{rejectDialog.userName}</strong> ({rejectDialog.userEmail})?
            They will be notified via email and will not be able to access the
            system.
          </>
        }
        confirmText="Reject"
        variant="destructive"
        loading={rejectUser.isPending}
      />

      {/* User Details Dialog */}
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
