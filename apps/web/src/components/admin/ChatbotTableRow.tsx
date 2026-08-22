"use client";

import { useState } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Pencil } from "lucide-react";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { toast } from "sonner";
import { validateAuthorName } from "./utils/author-name-validation";

type Chatbot = RouterOutputs["admin"]["getAllChatbots"]["chatbots"][number];

interface ChatbotTableRowProps {
  chatbot: Chatbot;
  currentUserId?: string;
  onDelete: (chatbotId: string, chatbotName: string, ownerName: string) => void;
  onRefetch: () => void;
}

export function ChatbotTableRow({
  chatbot,
  currentUserId,
  onDelete,
  onRefetch,
}: ChatbotTableRowProps) {
  const [editingAuthorName, setEditingAuthorName] = useState<{
    chatbotId: string;
    value: string;
  } | null>(null);
  const [authorNameError, setAuthorNameError] = useState<string | null>(null);

  const toggleFeatured = trpc.admin.toggleFeatured.useMutation({
    onSuccess: () => {
      onRefetch();
      toast.success("Featured status updated");
    },
    onError: (error) => {
      toast.error("Failed to update featured status", {
        description: error.message,
      });
    },
  });

  const updateAuthorName = trpc.admin.updateAuthorName.useMutation({
    onSuccess: () => {
      onRefetch();
      setEditingAuthorName(null);
      setAuthorNameError(null);
      toast.success("Author name updated");
    },
    onError: (error) => {
      setAuthorNameError(error.message);
      toast.error("Failed to update author name", {
        description: error.message,
      });
    },
  });

  const handleSaveAuthorName = (chatbotId: string, value: string) => {
    const error = validateAuthorName(value);
    if (error) {
      setAuthorNameError(error);
      return;
    }
    setAuthorNameError(null);
    updateAuthorName.mutate({
      chatbotId,
      authorName: value.trim() || null,
    });
  };

  const handleStartEditing = () => {
    if (chatbot.userId === currentUserId) {
      setEditingAuthorName({
        chatbotId: chatbot.id,
        value: chatbot.customAuthorName || "",
      });
      setAuthorNameError(null);
    }
  };

  const handleCancelEditing = () => {
    setEditingAuthorName(null);
    setAuthorNameError(null);
  };

  const isOwner = chatbot.userId === currentUserId;
  const displayAuthorName =
    chatbot.customAuthorName || chatbot.userName || "Unknown";

  return (
    <TableRow>
      <TableCell>
        <div>
          <p className="font-medium">{chatbot.name}</p>
          {chatbot.description && (
            <p className="text-xs text-muted-foreground truncate max-w-xs">
              {chatbot.description}
            </p>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div>
          {editingAuthorName?.chatbotId === chatbot.id ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Input
                  value={editingAuthorName.value}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    setEditingAuthorName({
                      chatbotId: chatbot.id,
                      value: newValue,
                    });
                    if (authorNameError) {
                      const error = validateAuthorName(newValue);
                      setAuthorNameError(error);
                    }
                  }}
                  onBlur={() => {
                    handleSaveAuthorName(chatbot.id, editingAuthorName.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSaveAuthorName(chatbot.id, editingAuthorName.value);
                    } else if (e.key === "Escape") {
                      handleCancelEditing();
                    }
                  }}
                  placeholder={chatbot.userName || "Unknown"}
                  className={`h-8 text-sm ${
                    authorNameError
                      ? "border-destructive focus-visible:ring-destructive"
                      : ""
                  }`}
                  maxLength={100}
                  autoFocus
                  disabled={updateAuthorName.isPending}
                />
              </div>
              {authorNameError && (
                <p className="text-xs text-destructive">{authorNameError}</p>
              )}
            </div>
          ) : (
            <div
              className={
                isOwner
                  ? "cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2 -my-1 transition-colors group"
                  : ""
              }
              onClick={handleStartEditing}
              title={
                isOwner
                  ? "Click to edit author name"
                  : "You can only edit author names for chatbots you created"
              }
            >
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{displayAuthorName}</p>
                {isOwner && (
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity" />
                )}
              </div>
              {chatbot.customAuthorName && (
                <p className="text-xs text-muted-foreground">
                  Original: {chatbot.userName || "Unknown"}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {chatbot.userEmail}
              </p>
            </div>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="secondary" className="text-xs">
          {chatbot.model.split("/").pop()}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant="outline">
          {chatbot.fileCount} file{chatbot.fileCount !== 1 ? "s" : ""}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="text-sm">
          <p>{new Date(chatbot.createdAt).toLocaleDateString()}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(chatbot.createdAt).toLocaleTimeString()}
          </p>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1.5">
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="w-fit">
                  <Switch
                    checked={chatbot.featured ?? false}
                    onCheckedChange={(checked) => {
                      toggleFeatured.mutate({
                        chatbotId: chatbot.id,
                        featured: checked,
                      });
                    }}
                    disabled={
                      toggleFeatured.isPending || !chatbot.sharingEnabled
                    }
                  />
                </div>
              </TooltipTrigger>
              {!chatbot.sharingEnabled && (
                <TooltipContent>
                  <p>
                    Only public chatbots (with sharing enabled) can be featured
                  </p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
          {!chatbot.sharingEnabled && (
            <Badge
              variant="outline"
              className="text-[10px] py-0 px-1.5 h-4 w-fit text-muted-foreground"
            >
              Private
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Button
          size="sm"
          variant="destructive"
          onClick={() =>
            onDelete(
              chatbot.id,
              chatbot.name,
              chatbot.userName || "Unknown User",
            )
          }
          disabled={toggleFeatured.isPending}
        >
          Delete
        </Button>
      </TableCell>
    </TableRow>
  );
}
