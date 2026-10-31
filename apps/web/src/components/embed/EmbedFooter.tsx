"use client";

import Link from "next/link";
import { PoweredBy } from "@/components/brand/PoweredBy";

interface EmbedFooterProps {
  /** The chatbot's model id, shown as its open-source LLM. */
  modelId: string;
}

export function EmbedFooter({ modelId }: EmbedFooterProps) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");

  return (
    <div className="flex items-center justify-center px-4 py-2 border-t border-border bg-muted/30 flex-shrink-0">
      <Link
        href={baseUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <PoweredBy modelId={modelId} className="justify-center" />
      </Link>
    </div>
  );
}
