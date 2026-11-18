import { Badge } from "@/components/ui/badge";
import { FileText, Globe } from "lucide-react";
import { describeSource, type SourceCitation } from "@/lib/message-sources";
import { useTranslation } from "react-i18next";

interface SourceBadgeProps {
  source: SourceCitation;
  /**
   * Pages this file was cited on, when several citations were grouped into one
   * badge. One page renders as "Page 4", several as "4 pages" with the list in
   * the tooltip, because spelling out every page is what made the source
   * footer outgrow the message.
   */
  pageNumbers?: number[];
  variant?: "secondary" | "outline";
  /** Show a similarity percentage as a tooltip (used in the live chat). */
  showSimilarityTooltip?: boolean;
  className?: string;
}

export function SourceBadge({
  source,
  pageNumbers,
  variant = "secondary",
  showSimilarityTooltip = false,
  className = "text-xs",
}: SourceBadgeProps) {
  const { t } = useTranslation();
  const { isWeb, label } = describeSource(source);
  // Web sources have no page concept; only file sources get a page suffix.
  const pages =
    pageNumbers ?? (source.pageNumber != null ? [source.pageNumber] : []);
  const pageSuffix =
    isWeb || pages.length === 0
      ? ""
      : pages.length === 1
        ? ` · ${t("chat.sources.page", { page: pages[0] })}`
        : ` · ${t("chat.sources.pageCount", { count: pages.length })}`;
  const displayLabel = `${label}${pageSuffix}`;

  const similarityNote = showSimilarityTooltip
    ? t("chat.sources.similarity", { similarity: source.similarity })
    : "";
  const pagesNote =
    pages.length > 1
      ? t("chat.sources.pagesList", { list: pages.join(", ") })
      : "";
  const title = [pagesNote, similarityNote].filter(Boolean).join(" · ");

  return (
    <Badge variant={variant} className={className} title={title || undefined}>
      {isWeb ? (
        <Globe className="h-3 w-3 mr-1" />
      ) : (
        <FileText className="h-3 w-3 mr-1" />
      )}
      {displayLabel}
    </Badge>
  );
}
