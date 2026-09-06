"use client";

import { Bot, ChevronDown, ExternalLink, Globe, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditableName } from "@/components/ui/editable-name";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { getSourceDisplayName } from "@/lib/crawler-metadata";
import type { Chatbot, DashboardSource } from "./types";

// A single button summarising attachment count; opens a checklist of chatbots.
// Scales to many chatbots (shows a count, not a row of badges).
export function ChatbotAttachButton({
  source,
  chatbots,
  onAttach,
  onDetach,
  isPending,
}: {
  source: DashboardSource;
  chatbots: Chatbot[];
  onAttach: (sourceId: string, chatbotId: string) => void;
  onDetach: (sourceId: string, chatbotId: string) => void;
  isPending: boolean;
}) {
  const count = source.chatbots.length;
  const attachedNames = source.chatbots.map((c) => c.name).join(", ");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-36 justify-between"
          title={
            count > 0 ? `Attached to: ${attachedNames}` : "Attach to chatbots"
          }
        >
          <span className="flex items-center">
            {count > 0 ? (
              <>
                <Bot className="mr-1.5 h-3.5 w-3.5" />
                {count} chatbot{count !== 1 ? "s" : ""}
              </>
            ) : (
              <>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Attach
              </>
            )}
          </span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Attach to chatbots</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {chatbots.length === 0 ? (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">
            No chatbots yet. Create one to attach this source.
          </div>
        ) : (
          chatbots.map((chatbot) => {
            const attached = source.chatbots.some((c) => c.id === chatbot.id);
            return (
              <DropdownMenuCheckboxItem
                key={chatbot.id}
                checked={attached}
                disabled={isPending}
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={(checked) => {
                  if (checked) {
                    onAttach(source.id, chatbot.id);
                  } else {
                    onDetach(source.id, chatbot.id);
                  }
                }}
              >
                <span className="truncate">{chatbot.name}</span>
              </DropdownMenuCheckboxItem>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function EnabledSwitch({
  source,
  onToggleEnabled,
  isTogglingEnabled,
}: {
  source: DashboardSource;
  onToggleEnabled: (sourceId: string, enabled: boolean) => void;
  isTogglingEnabled: boolean;
}) {
  return (
    <div
      title={
        source.enabled
          ? "Enabled — included in chat context. Toggle to disable."
          : "Disabled — kept but excluded from chat context. Toggle to enable."
      }
    >
      <Switch
        checked={source.enabled}
        onCheckedChange={(enabled) => onToggleEnabled(source.id, enabled)}
        disabled={isTogglingEnabled}
        aria-label={source.enabled ? "Disable source" : "Enable source"}
      />
    </div>
  );
}

export function NameCell({
  source,
  isRenaming,
  onRename,
}: {
  source: DashboardSource;
  isRenaming: boolean;
  onRename: (sourceId: string, name: string) => Promise<unknown>;
}) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Globe className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0">
        <EditableName
          value={getSourceDisplayName(source)}
          fallback={source.rootUrl}
          ariaLabel="Rename web source"
          isSaving={isRenaming}
          onSave={(name) => onRename(source.id, name)}
          className="text-sm font-medium"
        />
        <a
          href={source.rootUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <span className="truncate">{source.rootUrl}</span>
          <ExternalLink className="h-3 w-3 shrink-0" />
        </a>
      </div>
    </div>
  );
}
