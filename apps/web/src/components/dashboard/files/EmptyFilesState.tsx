"use client";

import { Card, CardContent } from "@/components/ui/card";
import { FileText } from "lucide-react";

export function EmptyFilesState() {
  return (
    <Card className="border-2 border-dashed">
      <CardContent className="p-8 md:p-16 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
          <FileText className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Import a file now</h3>
        <p className="text-muted-foreground">
          You don&apos;t have any files yet. Import a file.
        </p>
      </CardContent>
    </Card>
  );
}
