"use client";

import { useState } from "react";
import { ChevronDown, ExternalLink, FileText, Globe } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  citationFileHref,
  describeSource,
  type Citation,
} from "@/lib/message-sources";
import { cn } from "@/lib/utils";
import { CitationRefButton } from "./citation-marker";

interface CitationListProps {
  /** In the order the answer first cites them. */
  citations: Citation[];
  /** The citation selected by a marker or footnote, if any. */
  activeRef: number | null;
  onSelect: (refNumber: number) => void;
}

/**
 * The numbered footnotes under an assistant answer: one per passage the answer
 * cited, each with its file, page and an excerpt folded away until asked for.
 *
 * Each item carries `data-citation-ref` so the message can find and scroll to
 * the footnote for a clicked marker without ids, which would collide across the
 * several messages on one page that all start at [1].
 */
export function CitationList({
  citations,
  activeRef,
  onSelect,
}: CitationListProps) {
  const { t } = useTranslation();

  if (citations.length === 0) return null;

  return (
    <section
      aria-label={t("chat.citations.label")}
      className="mt-2 md:mt-3 flex flex-col gap-1.5"
    >
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <FileText className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="font-medium">{t("chat.citations.label")}</span>
      </div>
      <ol className="flex flex-col gap-1.5">
        {citations.map((citation) => (
          <CitationItem
            key={citation.ref}
            citation={citation}
            isActive={citation.ref === activeRef}
            onSelect={onSelect}
          />
        ))}
      </ol>
    </section>
  );
}

interface CitationItemProps {
  citation: Citation;
  isActive: boolean;
  onSelect: (refNumber: number) => void;
}

function CitationItem({ citation, isActive, onSelect }: CitationItemProps) {
  const { t } = useTranslation();
  const [isExcerptOpen, setIsExcerptOpen] = useState(false);
  const { isWeb, label } = describeSource(citation);
  // Web sources have no page concept, matching SourceBadge.
  const page = isWeb ? null : (citation.pageNumber ?? null);
  const SourceIcon = isWeb ? Globe : FileText;

  return (
    <li
      data-citation-ref={citation.ref}
      // The number button inside carries aria-current; this is styling only.
      data-active={isActive || undefined}
      className={cn(
        "rounded-md border px-2 py-1.5 text-xs transition-colors",
        isActive ? "border-primary/40 bg-primary/5" : "border-border",
      )}
    >
      <Collapsible open={isExcerptOpen} onOpenChange={setIsExcerptOpen}>
        <div className="flex flex-wrap items-center gap-1.5">
          <CitationRefButton
            refNumber={citation.ref}
            active={isActive}
            onSelect={onSelect}
          />
          <SourceIcon
            className="h-3 w-3 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <span className="min-w-0 truncate font-medium text-foreground">
            {label}
          </span>
          {page != null && (
            <span className="text-muted-foreground">
              · {t("chat.sources.page", { page })}
            </span>
          )}
          {citation.fileId && (
            <a
              href={citationFileHref(citation.fileId, page)}
              target="_blank"
              rel="noopener noreferrer"
              className="ms-auto inline-flex items-center gap-1 text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
            >
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
              {page != null
                ? t("chat.citations.openPage", { page })
                : t("chat.citations.openFile")}
            </a>
          )}
        </div>
        <CollapsibleTrigger className="group mt-1 inline-flex items-center gap-1 text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline">
          <ChevronDown
            className="h-3 w-3 transition-transform group-data-[state=open]:rotate-180"
            aria-hidden="true"
          />
          {t(
            isExcerptOpen
              ? "chat.citations.hideExcerpt"
              : "chat.citations.showExcerpt",
          )}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <blockquote className="mt-1 whitespace-pre-wrap border-s-2 border-border ps-2 italic leading-relaxed text-muted-foreground">
            {citation.excerpt}
          </blockquote>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}
