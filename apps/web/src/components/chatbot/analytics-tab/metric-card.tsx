"use client";

import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  isLoading,
}: {
  title: string;
  value: string | number;
  description: string;
  icon: LucideIcon;
  isLoading: boolean;
}) {
  return (
    <Card className="border border-border/60 shadow-xs">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase">
          {title}
        </CardTitle>
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">
          {isLoading ? <Skeleton className="h-9 w-20 rounded" /> : value}
        </div>
        <p className="text-xs text-muted-foreground mt-2">{description}</p>
      </CardContent>
    </Card>
  );
}

export function ChartSkeleton() {
  return (
    <div className="h-[280px] flex items-end gap-3 px-4 pb-6 pt-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton
          key={i}
          className="flex-1 rounded"
          style={{ height: `${35 + ((i * 17) % 50)}%` }}
        />
      ))}
    </div>
  );
}

export function EmptyChart({ label }: { label: string }) {
  return (
    <div className="h-[280px] flex items-center justify-center border border-dashed border-muted rounded-lg">
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
