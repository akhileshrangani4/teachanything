import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Clock,
  Loader2,
  SkipForward,
} from "lucide-react";
import { useTranslation } from "react-i18next";

export function SourceStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  switch (status) {
    case "completed":
      return (
        <Badge className="bg-green-600">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          {t("webSources.sourceStatus.completed")}
        </Badge>
      );
    case "crawling":
      return (
        <Badge className="bg-blue-600">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          {t("webSources.sourceStatus.crawling")}
        </Badge>
      );
    case "discovering":
      return (
        <Badge className="bg-blue-600">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          {t("webSources.sourceStatus.discovering")}
        </Badge>
      );
    case "pending":
      return (
        <Badge variant="secondary">
          <Clock className="h-3 w-3 mr-1" />
          {t("webSources.sourceStatus.pending")}
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive">
          <AlertCircle className="h-3 w-3 mr-1" />
          {t("webSources.sourceStatus.failed")}
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export function PageStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  switch (status) {
    case "completed":
      return (
        <Badge variant="outline" className="text-green-600 border-green-600">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          {t("webSources.pageStatus.completed")}
        </Badge>
      );
    case "processing":
      return (
        <Badge variant="outline" className="text-blue-600 border-blue-600">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          {t("webSources.pageStatus.processing")}
        </Badge>
      );
    case "pending":
      return (
        <Badge variant="outline">
          <Clock className="h-3 w-3 mr-1" />
          {t("webSources.sourceStatus.pending")}
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="outline" className="text-red-600 border-red-600">
          <AlertCircle className="h-3 w-3 mr-1" />
          {t("webSources.statusFilter.failed")}
        </Badge>
      );
    case "blocked":
      return (
        <Badge variant="outline" className="text-yellow-600 border-yellow-600">
          <Ban className="h-3 w-3 mr-1" />
          {t("webSources.pageStatus.blocked")}
        </Badge>
      );
    case "skipped":
      return (
        <Badge variant="outline" className="text-gray-500 border-gray-500">
          <SkipForward className="h-3 w-3 mr-1" />
          {t("webSources.pageStatus.skipped")}
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}
