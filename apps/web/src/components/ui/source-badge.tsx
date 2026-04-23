import { Badge } from "@/components/ui/badge";
import { FileText, Globe } from "lucide-react";
import { describeSource, type SourceCitation } from "@/lib/message-sources";

interface SourceBadgeProps {
  source: SourceCitation;
  variant?: "secondary" | "outline";
  /** Show a similarity percentage as a tooltip (used in the live chat). */
  showSimilarityTooltip?: boolean;
  className?: string;
}

export function SourceBadge({
  source,
  variant = "secondary",
  showSimilarityTooltip = false,
  className = "text-xs",
}: SourceBadgeProps) {
  const { isWeb, label } = describeSource(source);
  return (
    <Badge
      variant={variant}
      className={className}
      title={
        showSimilarityTooltip
          ? `Similarity: ${(source.similarity * 100).toFixed(1)}%`
          : undefined
      }
    >
      {isWeb ? (
        <Globe className="h-3 w-3 mr-1" />
      ) : (
        <FileText className="h-3 w-3 mr-1" />
      )}
      {label}
    </Badge>
  );
}
