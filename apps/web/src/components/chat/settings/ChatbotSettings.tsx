"use client";

import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { trpc } from "@/lib/trpc";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { MODEL_REGISTRY, type SupportedModel } from "@teachanything/ai/models";
import { toast } from "sonner";
import type { ChatbotSettingsChatbot, SettingsDraft } from "./settings-draft";
import { settingsFromChatbot } from "./settings-draft";
import { validateSettingsDraft } from "./settings-validation";
import { ConfigurationCard } from "./configuration-card";
import { DisplaySettingsCard } from "./display-settings-card";
import { ShareSettingsCard } from "./share-settings-card";
import { DangerZoneCard } from "./danger-zone-card";

interface ChatbotSettingsProps {
  chatbot: ChatbotSettingsChatbot;
}

export function ChatbotSettings({ chatbot }: ChatbotSettingsProps) {
  const params = useParams();
  const router = useRouter();
  const chatbotId = typeof params.id === "string" ? params.id : "";
  const [isEditing, setIsEditing] = useState(false);
  const [disableShareDialog, setDisableShareDialog] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Single draft object for all editable fields, initialized from props.
  // Server truth is never synced implicitly: callers reset the draft
  // explicitly on cancel / save / toggle-failure, so there are no
  // props-into-state effects.
  const [draft, setDraft] = useState<SettingsDraft>(() =>
    settingsFromChatbot(chatbot),
  );
  const { name, description, model, systemPrompt, temperature, maxTokens } =
    draft;

  const setField = <K extends keyof SettingsDraft>(
    key: K,
    value: SettingsDraft[K],
  ) => setDraft((d) => ({ ...d, [key]: value }));

  // A legacy chatbot may be saved on a model that no longer supports document
  // tools. When that happens we still render it as a selectable option so the
  // form stays valid and editing does not silently change the saved model.
  const savedModelIsNonTool =
    !!model &&
    !MODEL_REGISTRY[model as keyof typeof MODEL_REGISTRY]?.supportsTools;

  const utils = trpc.useUtils();

  const updateChatbot = trpc.chatbot.update.useMutation({
    onSuccess: async () => {
      await utils.chatbot.get.invalidate({ id: chatbotId });
      await utils.chatbot.getById.invalidate({ id: chatbotId });
    },
    onError: (error) => {
      toast.error("Failed to save settings", {
        description: error.message,
      });
    },
  });

  const generateShareToken = trpc.chatbot.generateShareToken.useMutation({
    onSuccess: async () => {
      // Invalidate both query keys
      await utils.chatbot.get.invalidate({ id: chatbotId });
      await utils.chatbot.getById.invalidate({ id: chatbotId });
      toast.success("Sharing enabled", {
        description: "Your chatbot is now publicly accessible",
      });
    },
    onError: (error) => {
      toast.error("Failed to enable sharing", {
        description: error.message,
      });
    },
  });

  const disableShare = trpc.chatbot.disableSharing.useMutation({
    onSuccess: async () => {
      // Invalidate both query keys
      await utils.chatbot.get.invalidate({ id: chatbotId });
      await utils.chatbot.getById.invalidate({ id: chatbotId });
      toast.success("Sharing disabled", {
        description: "Your chatbot is no longer publicly accessible",
      });
    },
    onError: (error) => {
      toast.error("Failed to disable sharing", {
        description: error.message,
      });
    },
  });

  const deleteChatbot = trpc.chatbot.delete.useMutation({
    onSuccess: () => {
      toast.success("Chatbot deleted successfully");
      router.push("/dashboard");
    },
    onError: (error) => {
      toast.error("Failed to delete chatbot", {
        description: error.message,
      });
    },
  });

  const toggleShowSources = trpc.chatbot.updateShowSources.useMutation({
    onSuccess: async (_, variables) => {
      // Without this the `chatbot` prop keeps the pre-toggle value, and
      // handleCancel — which resets the whole draft from that prop — would
      // silently flip the switch back.
      await utils.chatbot.get.invalidate({ id: chatbotId });
      await utils.chatbot.getById.invalidate({ id: chatbotId });
      toast.success(
        variables.showSources
          ? "Sources display enabled"
          : "Sources display disabled",
        {
          description: variables.showSources
            ? "Source citations will now be shown below assistant messages"
            : "Source citations will no longer be displayed",
        },
      );
    },
    onError: (error) => {
      setField("showSources", chatbot.showSources ?? false);
      toast.error("Failed to update setting", {
        description: error.message,
      });
    },
  });

  const handleEnableSharing = () => {
    generateShareToken.mutate({ id: chatbotId });
  };

  const handleDisableSharing = () => {
    setDisableShareDialog(true);
  };

  const confirmDisableShare = async () => {
    disableShare.mutate({ id: chatbotId });
    setDisableShareDialog(false);
  };

  const handleDeleteChatbot = () => {
    deleteChatbot.mutate({ id: chatbotId });
  };

  const handleToggleShowSources = (checked: boolean) => {
    setField("showSources", checked);
    toggleShowSources.mutate({ id: chatbotId, showSources: checked });
  };

  const handleSave = () => {
    const issue = validateSettingsDraft(draft);
    if (issue) {
      toast.error(issue.title, { description: issue.description });
      return;
    }

    updateChatbot.mutate(
      {
        id: chatbotId,
        data: {
          name: name.trim(),
          description: description.trim() || undefined,
          model: model as SupportedModel,
          systemPrompt,
          temperature: parseFloat(temperature),
          maxTokens: parseInt(maxTokens),
          showSources: draft.showSources,
        },
      },
      {
        // Reset from the row the server returned, never from the `chatbot`
        // prop: this callback closes over the pre-save value, so resetting
        // from it reverts the form to the user's old settings while the
        // toast claims success.
        onSuccess: (updated) => {
          setIsEditing(false);
          if (updated) setDraft(settingsFromChatbot(updated));
          toast.success("Settings saved successfully", {
            description: "Your chatbot configuration has been updated",
          });
        },
      },
    );
  };

  const handleCancel = () => {
    setDraft(settingsFromChatbot(chatbot));
    setIsEditing(false);
  };

  return (
    <div className="space-y-6">
      {/* Configuration Settings Card */}
      <ConfigurationCard
        draft={draft}
        setField={setField}
        isEditing={isEditing}
        onEditStart={() => setIsEditing(true)}
        onCancel={handleCancel}
        onSave={handleSave}
        isSaving={updateChatbot.isPending}
        savedModelIsNonTool={savedModelIsNonTool}
      />

      {/* Display Settings Card */}
      <DisplaySettingsCard
        showSources={draft.showSources}
        isToggling={toggleShowSources.isPending}
        onToggle={handleToggleShowSources}
      />

      {/* Share Settings Card */}
      <ShareSettingsCard
        chatbot={chatbot}
        isGenerating={generateShareToken.isPending}
        isDisabling={disableShare.isPending}
        onEnableSharing={handleEnableSharing}
        onDisableSharing={handleDisableSharing}
      />

      {/* Danger Zone Card */}
      <DangerZoneCard
        isDeleting={deleteChatbot.isPending}
        onDelete={() => setDeleteDialogOpen(true)}
      />

      {/* Disable Share Confirmation Dialog */}
      <ConfirmationDialog
        open={disableShareDialog}
        onOpenChange={setDisableShareDialog}
        onConfirm={confirmDisableShare}
        title="Disable Sharing"
        description="Are you sure you want to disable sharing? This will invalidate the current share link and users will no longer be able to access the chatbot through it."
        confirmText="Disable Sharing"
        variant="destructive"
        loading={disableShare.isPending}
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
