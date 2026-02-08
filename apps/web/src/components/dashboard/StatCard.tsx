"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: number | string | React.ReactNode;
  description: string;
  icon: LucideIcon;
  iconColor?: string;
  iconBgColor?: string;
  isLoading?: boolean;
  spinnerColor?: string;
}

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  iconColor = "text-primary",
  iconBgColor = "bg-primary/10",
  isLoading = false,
  spinnerColor = "border-primary",
}: StatCardProps) {
  return (
    <Card className="border border-border/60 bg-card card-hover-lift shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {title}
        </CardTitle>
        <div
          className={`h-10 w-10 rounded-lg ${iconBgColor} flex items-center justify-center`}
        >
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-4xl font-bold text-foreground mb-1">
          {isLoading ? (
            <span
              className={`inline-block w-8 h-8 border-2 ${spinnerColor} border-t-transparent rounded-full animate-spin`}
            />
          ) : (
            value
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-2">{description}</p>
      </CardContent>
    </Card>
  );
}
