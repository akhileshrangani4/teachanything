"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CharacterCounter } from "@/components/ui/character-counter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MAX_CUSTOM_MESSAGE_LENGTH,
  REGISTRATION_EMAIL_TEMPLATE_IDS,
  REGISTRATION_EMAIL_TEMPLATES,
  type RegistrationEmailTemplateId,
} from "@/lib/registration-email-templates";
import type { UserDialogState } from "./types";

export type SendEmailRequest =
  | { templateId: "request_more_info" | "incorrect_info" }
  | { templateId: "generic_admin_message"; customMessage: string };

interface SendEmailDialogProps {
  dialog: UserDialogState;
  onClose: () => void;
  onSend: (request: SendEmailRequest) => void;
  isSending: boolean;
}

/** Admin dialog for sending a registration email to a pending user. */
export function SendEmailDialog({
  dialog,
  onClose,
  onSend,
  isSending,
}: SendEmailDialogProps) {
  return (
    <Dialog open={dialog.isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Send registration email</DialogTitle>
          <DialogDescription>
            Email <strong>{dialog.userName}</strong> ({dialog.userEmail}).
            Replies go to the support address.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so each opening starts from a blank form. */}
        {dialog.isOpen && (
          <SendEmailForm
            recipientEmail={dialog.userEmail ?? ""}
            onCancel={onClose}
            onSend={onSend}
            isSending={isSending}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function SendEmailForm({
  recipientEmail,
  onCancel,
  onSend,
  isSending,
}: {
  recipientEmail: string;
  onCancel: () => void;
  onSend: (request: SendEmailRequest) => void;
  isSending: boolean;
}) {
  const [templateId, setTemplateId] =
    useState<RegistrationEmailTemplateId>("request_more_info");
  const [customMessage, setCustomMessage] = useState("");

  const template = REGISTRATION_EMAIL_TEMPLATES[templateId];
  const isCustom = templateId === "generic_admin_message";
  const canSend =
    !isSending &&
    (!isCustom ||
      (customMessage.trim().length > 0 &&
        customMessage.length <= MAX_CUSTOM_MESSAGE_LENGTH));

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSend) return;
        onSend(
          templateId === "generic_admin_message"
            ? { templateId, customMessage }
            : { templateId },
        );
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="registration-email-template">Template</Label>
        <Select
          value={templateId}
          onValueChange={(value) =>
            setTemplateId(value as RegistrationEmailTemplateId)
          }
          disabled={isSending}
        >
          <SelectTrigger id="registration-email-template">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REGISTRATION_EMAIL_TEMPLATE_IDS.map((id) => (
              <SelectItem key={id} value={id}>
                {REGISTRATION_EMAIL_TEMPLATES[id].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{template.summary}</p>
      </div>

      {isCustom && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="registration-email-message">Message</Label>
            <CharacterCounter
              current={customMessage.length}
              max={MAX_CUSTOM_MESSAGE_LENGTH}
            />
          </div>
          <Textarea
            id="registration-email-message"
            value={customMessage}
            onChange={(event) => setCustomMessage(event.target.value)}
            placeholder="Write the message the user will receive."
            rows={6}
            disabled={isSending}
            autoFocus
          />
        </div>
      )}

      <dl className="rounded-md border bg-muted/50 p-3 text-sm grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-muted-foreground">To</dt>
        <dd className="break-all">{recipientEmail}</dd>
        <dt className="text-muted-foreground">Subject</dt>
        <dd className="font-medium">{template.subject}</dd>
      </dl>

      <DialogFooter className="gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={!canSend}>
          {isSending ? "Sending..." : "Send email"}
        </Button>
      </DialogFooter>
    </form>
  );
}
