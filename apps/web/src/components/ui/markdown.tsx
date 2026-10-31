import { cn } from "@/lib/utils";
import { memo } from "react";
import { Streamdown } from "streamdown";
import type { Components } from "react-markdown";

export type MarkdownProps = {
  children: string;
  className?: string;
  parseIncompleteMarkdown?: boolean;
  style?: React.CSSProperties;
};

const markdownComponents: Components = {
  // `ms-6` (margin-inline-start) and `dir="auto"` put the markers on the
  // right for a right-to-left list (Hebrew, Arabic) instead of clipping them.
  ul: ({ children, className, ...props }) => (
    <ul
      dir="auto"
      className={cn("ms-6 list-outside list-disc whitespace-normal", className)}
      {...props}
    >
      {children}
    </ul>
  ),
  ol: ({ children, className, ...props }) => (
    <ol
      dir="auto"
      className={cn(
        "ms-6 list-outside list-decimal whitespace-normal",
        className,
      )}
      {...props}
    >
      {children}
    </ol>
  ),
};

function MarkdownComponent({
  children,
  className,
  parseIncompleteMarkdown = false,
  style,
}: MarkdownProps) {
  return (
    // `dir="auto"` lets the browser pick the direction from the text itself,
    // so a reply in Hebrew or Arabic reads right-to-left.
    <div
      dir="auto"
      className={cn("streamdown-content", className)}
      style={style}
    >
      <Streamdown
        parseIncompleteMarkdown={parseIncompleteMarkdown}
        components={markdownComponents}
      >
        {children}
      </Streamdown>
    </div>
  );
}

const Markdown = memo(MarkdownComponent);
Markdown.displayName = "Markdown";

export { Markdown };
