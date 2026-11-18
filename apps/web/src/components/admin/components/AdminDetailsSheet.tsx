"use client";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ChatbotDetailsPanel } from "./ChatbotDetailsPanel";
import { UserUsagePanel } from "./UserUsagePanel";

/** What the admin details panel shows: one chatbot or one professor. */
export type AdminPanelTarget =
  { kind: "chatbot"; id: string } | { kind: "user"; id: string } | null;

interface AdminDetailsSheetProps {
  target: AdminPanelTarget;
  onTargetChange: (target: AdminPanelTarget) => void;
  currentUserId?: string;
  /** Omit to hide Delete in the chatbot panel. */
  onDeleteChatbot?: (
    chatbotId: string,
    chatbotName: string,
    ownerName: string,
  ) => void;
}

/**
 * Side panel shared by the Chatbots and Users tabs. A chatbot's panel links
 * to its professor and a professor's panel links to each chatbot, so an
 * admin can raise both limits without switching tabs.
 */
export function AdminDetailsSheet({
  target,
  onTargetChange,
  currentUserId,
  onDeleteChatbot,
}: AdminDetailsSheetProps) {
  return (
    <Sheet
      open={target !== null}
      onOpenChange={(open) => !open && onTargetChange(null)}
    >
      <SheetContent>
        {target?.kind === "chatbot" && (
          <ChatbotDetailsPanel
            key={target.id}
            chatbotId={target.id}
            currentUserId={currentUserId}
            onOpenProfessor={(id) => onTargetChange({ kind: "user", id })}
            onDelete={onDeleteChatbot}
          />
        )}
        {target?.kind === "user" && (
          <UserUsagePanel
            key={target.id}
            userId={target.id}
            onOpenChatbot={(id) => onTargetChange({ kind: "chatbot", id })}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
