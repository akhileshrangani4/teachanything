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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_DAILY_MESSAGE_LIMIT } from "@/lib/constants/rate-limits";
import { parseDailyLimitInput } from "../utils/daily-limit-input";

interface DailyLimitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** The platform default that applies when no override is set. */
  defaultLimit: number;
  /** The current override, or null when the default applies. */
  currentLimit: number | null;
  isPending: boolean;
  /** Save an override, or null to return to the default. */
  onSave: (limit: number | null) => void;
}

/** Admin dialog for setting or clearing a daily message limit override. */
export function DailyLimitDialog({
  open,
  onOpenChange,
  title,
  description,
  ...formProps
}: DailyLimitDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so each opening starts from the saved value. */}
        <DailyLimitForm {...formProps} />
      </DialogContent>
    </Dialog>
  );
}

type DailyLimitFormProps = Pick<
  DailyLimitDialogProps,
  "defaultLimit" | "currentLimit" | "isPending" | "onSave"
>;

function DailyLimitForm({
  defaultLimit,
  currentLimit,
  isPending,
  onSave,
}: DailyLimitFormProps) {
  const [value, setValue] = useState(currentLimit?.toString() ?? "");
  const parsed = parseDailyLimitInput(value);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (parsed.ok) onSave(parsed.limit);
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="daily-message-limit">Messages per day</Label>
        <Input
          id="daily-message-limit"
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_DAILY_MESSAGE_LIMIT}
          placeholder={`${defaultLimit} (default)`}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={isPending}
          autoFocus
        />
        <p
          className={
            parsed.ok
              ? "text-xs text-muted-foreground"
              : "text-xs text-destructive"
          }
        >
          {parsed.ok
            ? `Leave empty to use the default of ${defaultLimit}. Resets at midnight US Eastern.`
            : `Enter a whole number from 1 to ${MAX_DAILY_MESSAGE_LIMIT.toLocaleString()}.`}
        </p>
      </div>
      <DialogFooter className="gap-2">
        {currentLimit !== null && (
          <Button
            type="button"
            variant="outline"
            onClick={() => onSave(null)}
            disabled={isPending}
          >
            Reset to default
          </Button>
        )}
        <Button type="submit" disabled={isPending || !parsed.ok}>
          Save
        </Button>
      </DialogFooter>
    </form>
  );
}
