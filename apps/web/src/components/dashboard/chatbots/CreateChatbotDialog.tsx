"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormFieldWithCounter } from "@/components/ui/form-field-with-counter";
import {
  validateName,
  validateDescription,
  VALIDATION_LIMITS,
} from "@/lib/validation";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import type React from "react";
import { MODELS, DEFAULT_FORM_DATA } from "./chatbot-constants";
import type { SupportedModel } from "@teachanything/ai/models";

interface CreateChatbotDialogProps {
  onSuccess?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}

export function CreateChatbotDialog({
  onSuccess,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  trigger,
}: CreateChatbotDialogProps) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const [formData, setFormData] = useState(DEFAULT_FORM_DATA);

  const isControlled = controlledOpen !== undefined;
  const dialogOpen = isControlled ? controlledOpen : internalOpen;
  const setDialogOpen: (open: boolean) => void = isControlled
    ? controlledOnOpenChange || (() => {})
    : setInternalOpen;

  const createChatbot = trpc.chatbot.create.useMutation({
    onSuccess: (data) => {
      setDialogOpen(false);
      setFormData(DEFAULT_FORM_DATA);
      toast.success("Chatbot created successfully!");
      onSuccess?.();
      // Redirect to the newly created chatbot
      if (data?.id) {
        router.push(`/chatbot/${data.id}`);
      }
    },
    onError: (error) => {
      toast.error("Failed to create chatbot", {
        description: error.message,
      });
    },
  });

  const handleCreateChatbot = async (e: React.FormEvent) => {
    e.preventDefault();

    const nameValidation = validateName(formData.name);
    if (!nameValidation.isValid) {
      toast.error(nameValidation.error!, {
        description: nameValidation.description,
      });
      return;
    }

    const descriptionValidation = validateDescription(
      formData.description,
      true,
    );
    if (!descriptionValidation.isValid) {
      toast.error(descriptionValidation.error!, {
        description: descriptionValidation.description,
      });
      return;
    }

    createChatbot.mutate({
      name: formData.name,
      model: formData.model as SupportedModel,
      systemPrompt: formData.systemPrompt,
      description: formData.description,
      temperature: formData.temperature,
      maxTokens: formData.maxTokens,
    });
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        className="max-w-2xl max-h-[80vh] overflow-y-auto"
        onOpenAutoFocus={(e) => {
          if (!trigger) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Create New Chatbot</DialogTitle>
          <DialogDescription>
            Configure your AI chatbot for your course
          </DialogDescription>
        </DialogHeader>

        {createChatbot.error && (
          <Alert variant="destructive">
            <AlertDescription>{createChatbot.error.message}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleCreateChatbot} className="space-y-4">
          <FormFieldWithCounter
            id="name"
            label="Chatbot Name"
            value={formData.name}
            onChange={(value) => setFormData({ ...formData, name: value })}
            maxLength={VALIDATION_LIMITS.NAME_MAX_LENGTH}
            warningThreshold={VALIDATION_LIMITS.NAME_WARNING_THRESHOLD}
            placeholder="CS101 Assistant"
            required
          />

          <FormFieldWithCounter
            id="description"
            label="Description"
            value={formData.description}
            onChange={(value) =>
              setFormData({ ...formData, description: value })
            }
            maxLength={VALIDATION_LIMITS.DESCRIPTION_MAX_LENGTH}
            warningThreshold={VALIDATION_LIMITS.DESCRIPTION_WARNING_THRESHOLD}
            placeholder="AI assistant for Introduction to Computer Science"
            type="textarea"
            rows={3}
            required
          />

          <div className="space-y-2">
            <Label htmlFor="model">AI Model *</Label>
            <Select
              value={formData.model}
              onValueChange={(value) =>
                setFormData({ ...formData, model: value as SupportedModel })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODELS.map((model) => (
                  <SelectItem key={model.value} value={model.value}>
                    {model.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="systemPrompt">System Prompt *</Label>
            <Textarea
              id="systemPrompt"
              placeholder="You are a helpful teaching assistant..."
              value={formData.systemPrompt}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  systemPrompt: e.target.value,
                })
              }
              rows={4}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="temperature">Temperature</Label>
              <Input
                id="temperature"
                type="number"
                min="0"
                max="100"
                step="1"
                value={formData.temperature}
                onChange={(e) => {
                  const parsed = parseInt(e.target.value);
                  if (!Number.isNaN(parsed)) {
                    setFormData({ ...formData, temperature: parsed });
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                Control randomness (0 = focused, 100 = creative)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxTokens">Max Tokens</Label>
              <Input
                id="maxTokens"
                type="number"
                min="100"
                max="4000"
                step="100"
                value={formData.maxTokens}
                onChange={(e) => {
                  const parsed = parseInt(e.target.value);
                  if (!Number.isNaN(parsed)) {
                    setFormData({ ...formData, maxTokens: parsed });
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                Maximum length of responses (100-4000)
              </p>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={createChatbot.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createChatbot.isPending}>
              {createChatbot.isPending ? "Creating..." : "Create Chatbot"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
