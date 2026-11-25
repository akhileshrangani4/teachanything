"use client";

import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Eye, MoreHorizontal, Pause, Play, Trash2 } from "lucide-react";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { toast } from "sonner";
import {
  CHATBOT_DAILY_MESSAGE_LIMIT,
  OWNER_DAILY_MESSAGE_LIMIT,
} from "@/lib/constants/rate-limits";
import { usageLevel } from "@/lib/usage-level";
import { ChatbotStatusBadges } from "./components/ChatbotStatusBadges";
import { UsageMeter } from "@/components/usage-meter/UsageMeter";
import { useSetChatbotPaused } from "./hooks/use-set-chatbot-paused";

type Chatbot = RouterOutputs["admin"]["getAllChatbots"]["chatbots"][number];

interface ChatbotTableRowProps {
  chatbot: Chatbot;
  onOpenDetails: (chatbotId: string) => void;
  onDelete: (chatbotId: string, chatbotName: string, ownerName: string) => void;
  onRefetch: () => void;
}

/** One chatbot: who owns it, today's usage, status, and quick actions. */
export function ChatbotTableRow({
  chatbot,
  onOpenDetails,
  onDelete,
  onRefetch,
}: ChatbotTableRowProps) {
  const ownerName = chatbot.userName || "Unknown";

  return (
    <TableRow
      className="cursor-pointer"
      onClick={() => onOpenDetails(chatbot.id)}
    >
      <TableCell>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpenDetails(chatbot.id);
          }}
          className="flex flex-col rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="font-medium hover:underline">{chatbot.name}</span>
          <span className="text-xs text-muted-foreground">
            {ownerName} · {chatbot.userEmail}
          </span>
        </button>
      </TableCell>
      <TableCell>
        <UsageMeter
          used={chatbot.usage.today}
          limit={chatbot.dailyMessageLimit ?? CHATBOT_DAILY_MESSAGE_LIMIT}
        />
      </TableCell>
      <TableCell className="tabular-nums">
        {chatbot.usage.last7Days.toLocaleString()}
      </TableCell>
      <TableCell className="tabular-nums">
        {chatbot.usage.last30Days.toLocaleString()}
      </TableCell>
      <TableCell>
        <ChatbotStatusBadges
          paused={chatbot.paused}
          ownerChatbotsPaused={chatbot.ownerChatbotsPaused ?? false}
          sharingEnabled={chatbot.sharingEnabled}
          isAtLimit={
            usageLevel(
              chatbot.usage.today,
              chatbot.dailyMessageLimit ?? CHATBOT_DAILY_MESSAGE_LIMIT,
            ) === "full"
          }
          isOwnerAtLimit={
            usageLevel(
              chatbot.ownerUsage.today,
              chatbot.ownerDailyMessageLimit ?? OWNER_DAILY_MESSAGE_LIMIT,
            ) === "full"
          }
        />
      </TableCell>
      <TableCell onClick={(event) => event.stopPropagation()}>
        <FeaturedSwitch chatbot={chatbot} onRefetch={onRefetch} />
      </TableCell>
      <TableCell
        className="text-right"
        onClick={(event) => event.stopPropagation()}
      >
        <ChatbotActionsMenu
          chatbot={chatbot}
          ownerName={ownerName}
          onOpenDetails={onOpenDetails}
          onDelete={onDelete}
        />
      </TableCell>
    </TableRow>
  );
}

function FeaturedSwitch({
  chatbot,
  onRefetch,
}: Pick<ChatbotTableRowProps, "chatbot" | "onRefetch">) {
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

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="w-fit">
            <Switch
              checked={chatbot.featured ?? false}
              onCheckedChange={(featured) =>
                toggleFeatured.mutate({ chatbotId: chatbot.id, featured })
              }
              disabled={toggleFeatured.isPending || !chatbot.sharingEnabled}
              aria-label="Featured on homepage"
            />
          </div>
        </TooltipTrigger>
        {!chatbot.sharingEnabled && (
          <TooltipContent>
            <p>Only public chatbots (with sharing enabled) can be featured</p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}

function ChatbotActionsMenu({
  chatbot,
  ownerName,
  onOpenDetails,
  onDelete,
}: Omit<ChatbotTableRowProps, "onRefetch"> & { ownerName: string }) {
  const { setPaused, isPending } = useSetChatbotPaused();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Chatbot actions">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => onOpenDetails(chatbot.id)}>
          <Eye className="mr-2 h-4 w-4" />
          Usage & settings
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isPending}
          onClick={() =>
            setPaused({ id: chatbot.id, name: chatbot.name }, !chatbot.paused)
          }
        >
          {chatbot.paused ? (
            <Play className="mr-2 h-4 w-4" />
          ) : (
            <Pause className="mr-2 h-4 w-4" />
          )}
          {chatbot.paused ? "Resume chatbot" : "Pause chatbot"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => onDelete(chatbot.id, chatbot.name, ownerName)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete chatbot
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
