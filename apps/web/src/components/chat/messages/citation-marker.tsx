"use client";

import { useTranslation } from "react-i18next";

import { badgeVariants } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface CitationMarkerProps {
  /**
   * The number the answer cited, as in "[2]". Named `refNumber` rather than
   * `ref` because React reserves `ref` on components.
   */
  refNumber: number;
  /** This citation is the one currently selected. */
  active: boolean;
  onSelect: (refNumber: number) => void;
}

/**
 * The numbered pill shared by the inline marker and its footnote, so a reader
 * matches "2" in the answer to "2" in the list by shape as well as number.
 *
 * A native button, so Enter and Space activate it without extra key handling.
 * The visible label is only the number; the accessible name ("Source 2") says
 * what the number is, since a bare digit read aloud mid-sentence is noise.
 */
export function CitationRefButton({
  refNumber,
  active,
  onSelect,
}: CitationMarkerProps) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={() => onSelect(refNumber)}
      aria-label={t("chat.citations.marker", { ref: refNumber })}
      aria-current={active ? "true" : undefined}
      className={cn(
        badgeVariants({ variant: active ? "default" : "outline" }),
        "h-4 min-w-4 justify-center px-1 py-0 text-[0.65rem] font-medium leading-none tabular-nums",
        !active &&
          "text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
    >
      {refNumber}
    </button>
  );
}

/**
 * The inline "[n]" in an assistant answer: a superscript button that selects
 * its footnote in `CitationList`.
 */
export function CitationMarker(props: CitationMarkerProps) {
  return (
    <sup className="ms-0.5 leading-none">
      <CitationRefButton {...props} />
    </sup>
  );
}
