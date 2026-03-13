"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Trash2 } from "lucide-react";
import type { RouterOutputs } from "@/lib/trpc";
import { formatFileSize, formatDate } from "./file-constants";
import { FileStatusBadge } from "./FileStatusBadge";

type FileData = RouterOutputs["files"]["list"]["files"][number];

interface FileCardProps {
  file: FileData;
  onDelete: (fileId: string) => void;
}

export function FileCard({ file, onDelete }: FileCardProps) {
  return (
    <Card className="border-2 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  {file.fileName}
                </h3>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground pl-[52px]">
              <span className="font-medium">
                {formatFileSize(file.fileSize)}
              </span>
              <span>•</span>
              <FileStatusBadge
                status={file.processingStatus}
                metadata={file.metadata}
                showProgress={false}
                size="sm"
              />
              <span>•</span>
              <span>{formatDate(file.createdAt)}</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(file.id)}
            className="text-destructive hover:text-destructive hover:bg-destructive/10 h-9 w-9"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
