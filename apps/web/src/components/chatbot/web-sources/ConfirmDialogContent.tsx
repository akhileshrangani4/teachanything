"use client";

import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConfirmDialogContentProps {
  title: string;
  description: string;
  cancelLabel: string;
  confirmLabel: string;
  onConfirm: () => void;
  /** Styles the confirm action as destructive. */
  destructive?: boolean;
}

/**
 * Standard confirmation-dialog body (header + cancel/confirm footer).
 * Must be rendered inside an <AlertDialog>, optionally next to an
 * <AlertDialogTrigger> for uncontrolled usage.
 */
export function ConfirmDialogContent({
  title,
  description,
  cancelLabel,
  confirmLabel,
  onConfirm,
  destructive = false,
}: ConfirmDialogContentProps) {
  return (
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
        <AlertDialogAction
          onClick={onConfirm}
          className={
            destructive
              ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              : undefined
          }
        >
          {confirmLabel}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
}
