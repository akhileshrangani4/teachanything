import Image from "next/image";
import { getModelDisplayName } from "@teachanything/ai/models";
import { BrandName } from "@/components/brand/BrandName";
import { cn } from "@/lib/utils";

interface PoweredByProps {
  /** The chatbot's model id (deprecated ids resolve to their replacement). */
  modelId: string;
  className?: string;
}

/**
 * "Powered by Teach Anything® · Open-source LLM: <model>" for the student
 * chat window, so students can see which model answers them.
 */
export function PoweredBy({ modelId, className }: PoweredByProps) {
  return (
    <span
      className={cn(
        "inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1.5">
        <span>Powered by</span>
        <Image
          src="/logo.svg"
          alt="Teach Anything®"
          width={14}
          height={14}
          className="h-3.5 w-3.5"
        />
        <BrandName serifAnything className="font-medium" />
      </span>
      <span aria-hidden="true">·</span>
      <span>Open-source LLM: {getModelDisplayName(modelId)}</span>
    </span>
  );
}
