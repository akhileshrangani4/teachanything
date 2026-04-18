"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { FormFieldWithCounter } from "@/components/ui/form-field-with-counter";
import { WrappableText } from "@/components/ui/wrappable-text";
import { CharacterCounter } from "@/components/ui/character-counter";
import { trpc } from "@/lib/trpc";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  MODEL_REGISTRY,
  type SupportedModel,
  formatContextWindow,
} from "@teachanything/ai/models";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import {
  validateName,
  validateDescription,
  VALIDATION_LIMITS,
} from "@/lib/validation";

// Group models by provider for the dropdown. Map preserves MODEL_REGISTRY insertion order.
const modelsByProvider = Object.values(MODEL_REGISTRY).reduce((acc, model) => {
  const group = acc.get(model.provider) ?? [];
  group.push(model);
  acc.set(model.provider, group);
  return acc;
}, new Map<string, (typeof MODEL_REGISTRY)[keyof typeof MODEL_REGISTRY][]>());

interface ChatbotSettingsProps {
  chatbot: {
    name: string;
    description: string | null;
    model: string;
    systemPrompt: string;
    temperature: number | null;
    maxTokens: number | null;
    shareToken: string | null;
    sharingEnabled: boolean;
    showSources?: boolean;
  };
}

export function ChatbotSettings({ chatbot }: ChatbotSettingsProps) {
  const params = useParams();
  const router = useRouter();
  const chatbotId = typeof params.id === "string" ? params.id : "";
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [disableShareDialog, setDisableShareDialog] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Editable state
  const [name, setName] = useState(chatbot.name);
  const [description, setDescription] = useState(chatbot.description ?? "");
  const [model, setModel] = useState(chatbot.model);
  const [systemPrompt, setSystemPrompt] = useState(chatbot.systemPrompt);
  const [temperature, setTemperature] = useState(
    chatbot.temperature?.toString() ?? "70",
  );
  const [maxTokens, setMaxTokens] = useState(
    chatbot.maxTokens?.toString() ?? "2000",
  );
  const [showSources, setShowSources] = useState(chatbot.showSources ?? false);

  // Sync editable fields from server only when not actively editing
  useEffect(() => {
    if (isEditing) return;
    setName(chatbot.name);
    setDescription(chatbot.description ?? "");
    setModel(chatbot.model);
    setSystemPrompt(chatbot.systemPrompt);
    setTemperature(chatbot.temperature?.toString() ?? "70");
    setMaxTokens(chatbot.maxTokens?.toString() ?? "2000");
  }, [chatbot, isEditing]);

  // Sync display settings independently (live toggle, not part of edit flow)
  useEffect(() => {
    setShowSources(chatbot.showSources ?? false);
  }, [chatbot.showSources]);

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

  const handleCopy = () => {
    if (chatbot.shareToken) {
      navigator.clipboard.writeText(
        `${window.location.origin}/chat/${chatbot.shareToken}`,
      );
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

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

  const toggleShowSources = trpc.chatbot.updateShowSources.useMutation({
    onSuccess: (_, variables) => {
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
      setShowSources(chatbot.showSources ?? false);
      toast.error("Failed to update setting", {
        description: error.message,
      });
    },
  });

  const handleToggleShowSources = (checked: boolean) => {
    setShowSources(checked);
    toggleShowSources.mutate({ id: chatbotId, showSources: checked });
  };

  const handleSave = () => {
    const tempValue = parseFloat(temperature);
    const tokensValue = parseInt(maxTokens);

    const nameValidation = validateName(name);
    if (!nameValidation.isValid) {
      toast.error(nameValidation.error!, {
        description: nameValidation.description,
      });
      return;
    }

    const descriptionValidation = validateDescription(description);
    if (!descriptionValidation.isValid) {
      toast.error(descriptionValidation.error!, {
        description: descriptionValidation.description,
      });
      return;
    }

    if (isNaN(tempValue) || tempValue < 0 || tempValue > 100) {
      toast.error("Invalid temperature", {
        description: "Temperature must be between 0 and 100",
      });
      return;
    }

    if (isNaN(tokensValue) || tokensValue < 100 || tokensValue > 4000) {
      toast.error("Invalid max tokens", {
        description: "Max tokens must be between 100 and 4000",
      });
      return;
    }

    if (!systemPrompt.trim()) {
      toast.error("System prompt is required", {
        description: "Please provide a system prompt for your chatbot",
      });
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
          temperature: tempValue,
          maxTokens: tokensValue,
          showSources: showSources,
        },
      },
      {
        onSuccess: () => {
          setIsEditing(false);
          toast.success("Settings saved successfully", {
            description: "Your chatbot configuration has been updated",
          });
        },
      },
    );
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  return (
    <div className="space-y-6">
      {/* Configuration Settings Card */}
      <div className="space-y-6 p-6 bg-muted/30 rounded-lg border">
        {/* Header with Edit Button */}
        <div className="flex items-center justify-between pb-4 border-b">
          <div>
            <h3 className="text-lg font-semibold">Configuration</h3>
            <p className="text-xs text-muted-foreground">
              Manage your chatbot settings
            </p>
          </div>
          {/* Edit/Save/Cancel buttons */}
          <div className="flex gap-2">
            {!isEditing ? (
              <Button
                onClick={() => setIsEditing(true)}
                variant="outline"
                size="sm"
              >
                Edit Settings
              </Button>
            ) : (
              <>
                <Button
                  onClick={handleCancel}
                  variant="outline"
                  size="sm"
                  disabled={updateChatbot.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  size="sm"
                  disabled={updateChatbot.isPending}
                >
                  {updateChatbot.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Name */}
        {isEditing ? (
          <FormFieldWithCounter
            id="name"
            label="Name"
            value={name}
            onChange={setName}
            maxLength={VALIDATION_LIMITS.NAME_MAX_LENGTH}
            warningThreshold={VALIDATION_LIMITS.NAME_WARNING_THRESHOLD}
            helperText="The display name for your chatbot"
            placeholder="Enter chatbot name"
            showCounter={isEditing}
          />
        ) : (
          <div className="space-y-2">
            <Label className="text-base font-semibold">Name</Label>
            <p className="text-xs text-muted-foreground mb-2">
              The display name for your chatbot
            </p>
            <div className="px-3 py-2 bg-background rounded-md border">
              <p className="text-sm">{name}</p>
            </div>
          </div>
        )}

        {/* Description */}
        {isEditing ? (
          <FormFieldWithCounter
            id="description"
            label="Description"
            value={description}
            onChange={setDescription}
            maxLength={VALIDATION_LIMITS.DESCRIPTION_MAX_LENGTH}
            warningThreshold={VALIDATION_LIMITS.DESCRIPTION_WARNING_THRESHOLD}
            helperText="A brief description of what your chatbot does"
            placeholder="Enter chatbot description (optional)"
            type="textarea"
            rows={3}
          />
        ) : (
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <Label className="text-base font-semibold">Description</Label>
              <CharacterCounter
                current={description.length}
                max={VALIDATION_LIMITS.DESCRIPTION_MAX_LENGTH}
                warningThreshold={
                  VALIDATION_LIMITS.DESCRIPTION_WARNING_THRESHOLD
                }
              />
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              A brief description of what your chatbot does
            </p>
            <div className="px-3 py-2 bg-background rounded-md border">
              <p className="text-sm">
                <WrappableText>{description || "No description"}</WrappableText>
              </p>
            </div>
          </div>
        )}

        {/* Model */}
        <div className="space-y-2">
          <Label htmlFor="model" className="text-base font-semibold">
            Model
          </Label>
          <p className="text-xs text-muted-foreground mb-2">
            Choose the AI model to power your chatbot
          </p>
          {isEditing ? (
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger id="model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from(modelsByProvider.entries()).map(
                  ([provider, models]) => (
                    <SelectGroup key={provider}>
                      <SelectLabel>{provider}</SelectLabel>
                      {models.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.displayName} (
                          {formatContextWindow(m.contextWindow)})
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ),
                )}
              </SelectContent>
            </Select>
          ) : (
            <div className="px-3 py-2 bg-background rounded-md border">
              <p className="text-sm">
                {MODEL_REGISTRY[model as keyof typeof MODEL_REGISTRY]
                  ?.displayName ?? model}
              </p>
            </div>
          )}
        </div>

        {/* System Prompt */}
        <div className="space-y-2">
          <Label htmlFor="systemPrompt" className="text-base font-semibold">
            System Prompt
          </Label>
          <p className="text-xs text-muted-foreground mb-2">
            Define how your chatbot should behave and respond
          </p>
          <Textarea
            id="systemPrompt"
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            disabled={!isEditing}
            rows={6}
            className={
              !isEditing
                ? "bg-background resize-none"
                : "resize-y min-h-[150px]"
            }
          />
        </div>

        {/* Temperature and Max Tokens */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="temperature" className="text-base font-semibold">
              Temperature
            </Label>
            <p className="text-xs text-muted-foreground mb-2">
              Control randomness (0 = focused, 100 = creative)
            </p>
            {isEditing ? (
              <Input
                id="temperature"
                type="number"
                min="0"
                max="100"
                step="1"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
              />
            ) : (
              <div className="px-3 py-2 bg-background rounded-md border">
                <p className="text-sm">{temperature}</p>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxTokens" className="text-base font-semibold">
              Max Tokens
            </Label>
            <p className="text-xs text-muted-foreground mb-2">
              Maximum length of responses (100-4000)
            </p>
            {isEditing ? (
              <Input
                id="maxTokens"
                type="number"
                min="100"
                max="4000"
                step="100"
                value={maxTokens}
                onChange={(e) => setMaxTokens(e.target.value)}
              />
            ) : (
              <div className="px-3 py-2 bg-background rounded-md border">
                <p className="text-sm">{maxTokens}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Display Settings Card */}
      <div className="space-y-4 p-6 bg-muted/30 rounded-lg border">
        <div className="space-y-1">
          <Label className="text-base font-semibold">Display Settings</Label>
          <p className="text-xs text-muted-foreground">
            Configure how messages are displayed in the chat
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="showSources" className="text-sm font-medium">
              Show Sources
            </Label>
            <p className="text-xs text-muted-foreground">
              Display source file citations below assistant messages
            </p>
          </div>
          <Switch
            id="showSources"
            checked={showSources}
            onCheckedChange={handleToggleShowSources}
            disabled={toggleShowSources.isPending}
          />
        </div>
      </div>

      {/* Share Settings Card */}
      <div className="space-y-4 p-6 bg-muted/30 rounded-lg border">
        <div className="space-y-1">
          <Label className="text-base font-semibold">Share Settings</Label>
          <p className="text-xs text-muted-foreground">
            {chatbot.sharingEnabled
              ? "Your chatbot is publicly accessible via the link below"
              : "Enable sharing to generate a public link for your chatbot"}
          </p>
        </div>

        {chatbot.sharingEnabled && chatbot.shareToken ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={`${window.location.origin}/chat/${chatbot.shareToken}`}
                readOnly
                className="font-mono text-sm bg-background"
              />
              <Button
                variant="outline"
                onClick={handleCopy}
                disabled={copied}
                className="shrink-0"
              >
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDisableSharing}
              disabled={disableShare.isPending}
            >
              {disableShare.isPending ? "Disabling..." : "Disable Sharing"}
            </Button>
          </div>
        ) : (
          <Button
            onClick={handleEnableSharing}
            disabled={generateShareToken.isPending}
            className="w-full sm:w-auto"
          >
            {generateShareToken.isPending ? "Generating..." : "Enable Sharing"}
          </Button>
        )}
      </div>

      {/* Danger Zone Card */}
      <div className="space-y-4 p-6 bg-destructive/5 rounded-lg border border-destructive/20">
        <div className="space-y-1">
          <Label className="text-base font-semibold text-destructive">
            Danger Zone
          </Label>
          <p className="text-xs text-muted-foreground">
            Permanently delete this chatbot and all associated data
          </p>
        </div>

        <Button
          variant="destructive"
          onClick={() => setDeleteDialogOpen(true)}
          disabled={deleteChatbot.isPending}
          className="w-full sm:w-auto"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Chatbot
        </Button>
      </div>

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
