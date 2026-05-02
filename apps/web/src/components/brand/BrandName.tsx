import { cn } from "@/lib/utils";

interface BrandNameProps {
  className?: string;
  markClassName?: string;
  anythingClassName?: string;
  serifAnything?: boolean;
}

export const BRAND_NAME_WITH_MARK = "Teach Anything™";

export function BrandName({
  className,
  markClassName,
  anythingClassName,
  serifAnything = false,
}: BrandNameProps) {
  return (
    <span className={cn(className)}>
      Teach{" "}
      <span
        className={cn(serifAnything && "italic", anythingClassName)}
        style={
          serifAnything
            ? {
                fontFamily: "var(--font-instrument-serif), serif",
                fontWeight: 400,
              }
            : undefined
        }
      >
        Anything
      </span>
      <sup
        className={cn(
          "ml-1.5 align-super text-[0.42em] font-semibold not-italic leading-none tracking-normal",
          markClassName,
        )}
      >
        TM
      </sup>
    </span>
  );
}
