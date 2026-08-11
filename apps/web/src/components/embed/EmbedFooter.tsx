"use client";

import Image from "next/image";
import Link from "next/link";
import { BrandName } from "@/components/brand/BrandName";

export function EmbedFooter() {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");

  return (
    <div className="flex items-center justify-center px-4 py-2 border-t border-border bg-muted/30 flex-shrink-0">
      <Link
        href={baseUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>Powered by</span>
        <Image
          src="/logo.svg"
          alt="Teach Anything®"
          width={14}
          height={14}
          className="h-3.5 w-3.5"
        />
        <BrandName serifAnything className="font-medium" />
      </Link>
    </div>
  );
}
