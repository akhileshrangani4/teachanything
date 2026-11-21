"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function PaginationControls({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationControlsProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground">
        {t("common.table.pageOf", {
          current: currentPage + 1,
          total: totalPages,
        })}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(0, currentPage - 1))}
          disabled={currentPage === 0}
        >
          <ChevronLeft className="h-4 w-4 sm:mr-1" />
          <span className="hidden sm:inline">
            {t("common.actions.previous")}
          </span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            onPageChange(Math.min(totalPages - 1, currentPage + 1))
          }
          disabled={currentPage >= totalPages - 1}
        >
          <span className="hidden sm:inline">{t("common.actions.next")}</span>
          <ChevronRight className="h-4 w-4 sm:ml-1" />
        </Button>
      </div>
    </div>
  );
}
