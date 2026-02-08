"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { trpc } from "@/lib/trpc";
import { useSession } from "@/lib/auth-client";
import { toast } from "sonner";
import { ChatbotTableRow } from "../ChatbotTableRow";
import { PaginationControls } from "../../dashboard/files/PaginationControls";
import {
  TableToolbar,
  SortableTableHead,
  type AdminChatbotSortBy,
} from "@/components/data-table";
import { useServerTable } from "@/hooks/useServerTable";
import { StatsHeader } from "../components/StatsHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/ui/skeletons";
import { Bot } from "lucide-react";
import { keepPreviousData } from "@tanstack/react-query";

const ITEMS_PER_PAGE = 10;

type DeleteDialogState = {
  isOpen: boolean;
  chatbotId: string | null;
  chatbotName: string | null;
  ownerName: string | null;
};

export function AllChatbotsTab() {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;

  const { state, searchInput, actions, queryParams } =
    useServerTable<AdminChatbotSortBy>(
      { defaultSortBy: "createdAt", defaultSortDir: "desc" },
      ITEMS_PER_PAGE,
    );

  const [deleteChatbotDialog, setDeleteChatbotDialog] =
    useState<DeleteDialogState>({
      isOpen: false,
      chatbotId: null,
      chatbotName: null,
      ownerName: null,
    });

  const {
    data: chatbotsData,
    isLoading: chatbotsLoading,
    isFetching,
    refetch: refetchChatbots,
  } = trpc.admin.getAllChatbots.useQuery(
    {
      limit: ITEMS_PER_PAGE,
      ...queryParams,
    },
    {
      placeholderData: keepPreviousData,
    },
  );

  const allChatbots = chatbotsData?.chatbots || [];
  const totalCount = chatbotsData?.totalCount || 0;
  const featuredCount = chatbotsData?.featuredCount || 0;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const deleteChatbot = trpc.admin.deleteChatbot.useMutation({
    onSuccess: () => {
      refetchChatbots();
      toast.success("Chatbot deleted successfully", {
        description: "The chatbot and all associated data have been removed",
      });
    },
    onError: (error) => {
      toast.error("Failed to delete chatbot", {
        description: error.message,
      });
    },
  });

  const handleDeleteChatbot = (
    chatbotId: string,
    chatbotName: string,
    ownerName: string,
  ) => {
    setDeleteChatbotDialog({
      isOpen: true,
      chatbotId,
      chatbotName,
      ownerName,
    });
  };

  const confirmDeleteChatbot = async () => {
    if (!deleteChatbotDialog.chatbotId) return;
    await deleteChatbot.mutateAsync({
      chatbotId: deleteChatbotDialog.chatbotId,
    });
    setDeleteChatbotDialog({
      isOpen: false,
      chatbotId: null,
      chatbotName: null,
      ownerName: null,
    });
  };

  const closeDeleteDialog = () => {
    setDeleteChatbotDialog({
      isOpen: false,
      chatbotId: null,
      chatbotName: null,
      ownerName: null,
    });
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-4">
          <StatsHeader
            title="All Chatbots"
            description="Manage all chatbots across the platform"
            stats={[
              { value: totalCount, label: "All" },
              { value: featuredCount, label: "Featured", highlight: true },
            ]}
          />
        </CardHeader>
        <CardContent>
          {/* Admin Capabilities Info */}
          <Alert className="mb-4 border-border bg-muted/30">
            <AlertDescription className="text-xs leading-relaxed">
              <strong>Quick Guide:</strong>
              <ul className="mt-1 list-disc list-inside space-y-0.5">
                <li>Feature public chatbots for homepage (max 4)</li>
                <li>Click owner name to edit (your chatbots only)</li>
                <li>Delete to remove permanently</li>
              </ul>
            </AlertDescription>
          </Alert>

          {deleteChatbot.error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{deleteChatbot.error.message}</AlertDescription>
            </Alert>
          )}

          <TableToolbar
            searchValue={searchInput}
            onSearchChange={actions.setSearch}
            placeholder="Search chatbots by name, description, or owner..."
            totalCount={totalCount}
            visibleCount={allChatbots.length}
            itemLabel="chatbot"
            isLoading={isFetching && !chatbotsLoading}
            className="w-full"
          />

          {chatbotsLoading && !chatbotsData ? (
            <TableSkeleton
              minWidth={700}
              header={
                <>
                  <Skeleton className="h-4 w-14 shrink-0" />
                  <Skeleton className="h-4 w-14 shrink-0" />
                  <Skeleton className="h-4 w-14 shrink-0" />
                  <Skeleton className="h-4 w-10 shrink-0" />
                  <Skeleton className="h-4 w-16 shrink-0" />
                  <Skeleton className="h-4 w-20 shrink-0" />
                  <Skeleton className="h-4 w-14 shrink-0" />
                </>
              }
              row={
                <>
                  <Skeleton className="h-4 w-28 shrink-0" />
                  <Skeleton className="h-4 w-24 shrink-0" />
                  <Skeleton className="h-4 w-20 shrink-0" />
                  <Skeleton className="h-4 w-8 shrink-0" />
                  <Skeleton className="h-4 w-20 shrink-0" />
                  <Skeleton className="h-5 w-12 rounded-full shrink-0" />
                  <Skeleton className="h-8 w-16 rounded-md shrink-0" />
                </>
              }
            />
          ) : allChatbots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Bot className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
              <p className="text-lg font-medium text-foreground mb-1">
                No chatbots found
              </p>
              <p className="text-sm text-muted-foreground">
                {state.search || searchInput
                  ? "Try adjusting your search terms"
                  : "Chatbots will appear here once users create them"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <SortableTableHead
                        column="name"
                        currentSortBy={state.sortBy}
                        currentSortDir={state.sortDir}
                        onSort={actions.toggleSort}
                      >
                        Name
                      </SortableTableHead>
                      <SortableTableHead
                        column="owner"
                        currentSortBy={state.sortBy}
                        currentSortDir={state.sortDir}
                        onSort={actions.toggleSort}
                      >
                        Owner
                      </SortableTableHead>
                      <SortableTableHead
                        column="model"
                        currentSortBy={state.sortBy}
                        currentSortDir={state.sortDir}
                        onSort={actions.toggleSort}
                      >
                        Model
                      </SortableTableHead>
                      <SortableTableHead
                        column="fileCount"
                        currentSortBy={state.sortBy}
                        currentSortDir={state.sortDir}
                        onSort={actions.toggleSort}
                      >
                        Files
                      </SortableTableHead>
                      <SortableTableHead
                        column="createdAt"
                        currentSortBy={state.sortBy}
                        currentSortDir={state.sortDir}
                        onSort={actions.toggleSort}
                      >
                        Created
                      </SortableTableHead>
                      <SortableTableHead
                        column="featured"
                        currentSortBy={state.sortBy}
                        currentSortDir={state.sortDir}
                        onSort={actions.toggleSort}
                      >
                        Featured
                      </SortableTableHead>
                      <TableHead className="font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allChatbots.map((chatbot) => (
                      <ChatbotTableRow
                        key={chatbot.id}
                        chatbot={chatbot}
                        currentUserId={currentUserId}
                        onDelete={handleDeleteChatbot}
                        onRefetch={refetchChatbots}
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

      <ConfirmationDialog
        open={deleteChatbotDialog.isOpen}
        onOpenChange={(open) => !open && closeDeleteDialog()}
        onConfirm={confirmDeleteChatbot}
        title="Delete Chatbot"
        description={
          <>
            Are you sure you want to delete the chatbot{" "}
            <strong>{deleteChatbotDialog.chatbotName}</strong> owned by{" "}
            <strong>{deleteChatbotDialog.ownerName}</strong>?
            <br />
            <br />
            <span className="text-destructive font-semibold">
              Warning: This action cannot be undone.
            </span>{" "}
            All associated data including files, conversations, and analytics
            will be permanently removed from the system.
          </>
        }
        confirmText="Delete Chatbot"
        variant="destructive"
        loading={deleteChatbot.isPending}
      />
    </>
  );
}
