"use client";

import { Card, CardContent } from "@/components/ui/card";
import { FileText } from "lucide-react";
import { useTranslation } from "react-i18next";

export function EmptyFilesState() {
  const { t } = useTranslation();
  return (
    <Card className="border-2 border-dashed">
      <CardContent className="p-8 md:p-16 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
          <FileText className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-semibold mb-2">
          {t("files.page.emptyTitle")}
        </h3>
        <p className="text-muted-foreground">
          {t("files.page.emptyDescription")}
        </p>
      </CardContent>
    </Card>
  );
}
