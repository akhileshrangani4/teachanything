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
import { useTranslation } from "react-i18next";
import { serverErrorMessage } from "@/lib/server-error-message";

interface ChatbotSettingsProps {
  chatbot: ChatbotSettingsChatbot;
}

export function ChatbotSettings({ chatbot }: ChatbotSettingsProps) {
  const { t } = useTranslation();
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
      toast.error(t("chatbotSettings.toasts.saveFailed"), {
        description: serverErrorMessage(t, error),
      });
    },
  });

  const generateShareToken = trpc.chatbot.generateShareToken.useMutation({
    onSuccess: async () => {
      // Invalidate both query keys
      await utils.chatbot.get.invalidate({ id: chatbotId });
      await utils.chatbot.getById.invalidate({ id: chatbotId });
      toast.success(t("chatbotSettings.toasts.sharingEnabled"), {
        description: t("chatbotSettings.toasts.sharingEnabledDescription"),
      });
    },
    onError: (error) => {
      toast.error(t("chatbotSettings.toasts.enableSharingFailed"), {
        description: serverErrorMessage(t, error),
      });
    },
  });

  const disableShare = trpc.chatbot.disableSharing.useMutation({
    onSuccess: async () => {
      // Invalidate both query keys
      await utils.chatbot.get.invalidate({ id: chatbotId });
      await utils.chatbot.getById.invalidate({ id: chatbotId });
      toast.success(t("chatbotSettings.toasts.sharingDisabled"), {
        description: t("chatbotSettings.toasts.sharingDisabledDescription"),
      });
    },
    onError: (error) => {
      toast.error(t("chatbotSettings.toasts.disableSharingFailed"), {
        description: serverErrorMessage(t, error),
      });
    },
  });

  const deleteChatbot = trpc.chatbot.delete.useMutation({
    onSuccess: () => {
      toast.success(t("chatbots.delete.success"));
      router.push("/dashboard");
    },
    onError: (error) => {
      toast.error(t("chatbots.delete.failed"), {
        description: serverErrorMessage(t, error),
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
          ? t("chatbotSettings.toasts.sourcesEnabled")
          : t("chatbotSettings.toasts.sourcesDisabled"),
        {
          description: variables.showSources
            ? t("chatbotSettings.toasts.sourcesEnabledDescription")
            : t("chatbotSettings.toasts.sourcesDisabledDescription"),
        },
      );
    },
    onError: (error) => {
      setField("showSources", chatbot.showSources ?? false);
      toast.error(t("chatbotSettings.toasts.updateFailed"), {
        description: serverErrorMessage(t, error),
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
    const issue = validateSettingsDraft(draft, t);
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
          // Sent even when empty, unlike description: clearing the field
          // must clear the message so the chat falls back to the default.
          welcomeMessage: draft.welcomeMessage.trim(),
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
          toast.success(t("chatbotSettings.toasts.saveSuccess"), {
            description: t("chatbotSettings.toasts.saveSuccessDescription"),
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
        title={t("chatbotSettings.disableSharing.title")}
        description={t("chatbotSettings.disableSharing.description")}
        confirmText={t("chatbotSettings.disableSharing.title")}
        variant="destructive"
        loading={disableShare.isPending}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteChatbot}
        title={t("chatbots.delete.title")}
        description={t("chatbots.delete.description")}
        confirmText={t("common.actions.delete")}
        cancelText={t("common.actions.cancel")}
        variant="destructive"
        loading={deleteChatbot.isPending}
      />
    </div>
  );
}
