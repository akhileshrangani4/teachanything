"use client";

import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { CreateChatbotDialog } from "@/components/dashboard/chatbots/CreateChatbotDialog";
import { ChatbotCard } from "@/components/dashboard/chatbots/ChatbotCard";
import { EmptyChatbotsState } from "@/components/dashboard/chatbots/EmptyChatbotsState";
import { PaginationControls } from "@/components/dashboard/files/PaginationControls";
import { TableToolbar, type ChatbotSortBy } from "@/components/data-table";
import { useServerTable } from "@/hooks/useServerTable";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { keepPreviousData } from "@tanstack/react-query";

const ITEMS_PER_PAGE = 4;

export default function ChatbotsPage() {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [chatbotToDelete, setChatbotToDelete] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { state, searchInput, actions, queryParams } =
    useServerTable<ChatbotSortBy>(
      { defaultSortBy: "createdAt", defaultSortDir: "desc" },
      ITEMS_PER_PAGE,
    );

  // Fetch chatbots
  const {
    data: chatbotsData,
    isLoading: chatbotsLoading,
    isFetching,
    refetch,
  } = trpc.chatbot.list.useQuery(
    {
      limit: ITEMS_PER_PAGE,
      ...queryParams,
    },
    {
      placeholderData: keepPreviousData,
    },
  );

  const chatbots = chatbotsData?.chatbots || [];
  const totalCount = chatbotsData?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  // Delete chatbot mutation
  const deleteChatbot = trpc.chatbot.delete.useMutation({
    onSuccess: async () => {
      setDeleteDialogOpen(false);
      setChatbotToDelete(null);

      // Refetch to get updated count
      const result = await refetch();
      const newTotalCount = result.data?.totalCount || 0;
      const newTotalPages = Math.ceil(newTotalCount / ITEMS_PER_PAGE);

      // If we're on a page that no longer exists, go back to the last valid page
      if (state.page >= newTotalPages && newTotalPages > 0) {
        actions.setPage(newTotalPages - 1);
      }

      toast.success("Chatbot deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete chatbot", {
        description: error.message,
      });
    },
  });

  const handleDeleteChatbot = () => {
    if (chatbotToDelete) {
      deleteChatbot.mutate({ id: chatbotToDelete });
    }
  };

  const handleDelete = (chatbotId: string) => {
    setChatbotToDelete(chatbotId);
    setDeleteDialogOpen(true);
  };

  // Show full loading only on initial load (no data yet)
  const showFullLoading = chatbotsLoading && !chatbotsData;
  // Show inline loading indicator when fetching but have data
  const showInlineLoading = isFetching && !chatbotsLoading;

  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
          <div>
            <h1 className="text-4xl font-bold text-foreground tracking-tight">
              Chatbots
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">
              Create and manage your chatbots.
              {totalCount > 0 && (
                <span className="ml-2 font-medium text-foreground">
                  ({totalCount} {totalCount === 1 ? "chatbot" : "chatbots"})
                </span>
              )}
            </p>
          </div>
          <CreateChatbotDialog
            onSuccess={refetch}
            trigger={
              <Button
                size="lg"
                className="shadow-sm hover:shadow-md transition-shadow"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Chatbot
              </Button>
            }
          />
        </div>

        {/* Chatbots List */}
        {showFullLoading ? (
          <div className="grid gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="border border-border/60 rounded-lg p-6 space-y-3"
              >
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-64" />
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : chatbots.length === 0 && !state.search && !searchInput ? (
          <EmptyChatbotsState onCreateClick={() => setCreateDialogOpen(true)} />
        ) : (
          <div className="space-y-6">
            <TableToolbar
              searchValue={searchInput}
              onSearchChange={actions.setSearch}
              placeholder="Search chatbots by name or description..."
              totalCount={totalCount}
              visibleCount={chatbots.length}
              itemLabel="chatbot"
              isLoading={showInlineLoading}
            />
            {chatbots.length === 0 && state.search ? (
              <div className="text-center py-8 text-muted-foreground">
                No chatbots match your search
              </div>
            ) : (
              <>
                <div className="grid gap-4">
                  {chatbots.map((chatbot) => (
                    <ChatbotCard
                      key={chatbot.id}
                      chatbot={chatbot}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
                {totalPages > 1 && (
                  <PaginationControls
                    currentPage={state.page}
                    totalPages={totalPages}
                    onPageChange={actions.setPage}
                  />
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Create Chatbot Dialog (for empty state) */}
      <CreateChatbotDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={() => {
          setCreateDialogOpen(false);
          refetch();
        }}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteChatbot}
        title="Delete Chatbot"
        description="Are you sure you want to delete this chatbot? This action cannot be undone and will permanently delete all uploaded files, conversation history, and analytics data."
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        loading={deleteChatbot.isPending}
      />
    </div>
  );
}
