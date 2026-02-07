import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Markdown } from "./markdown";

export type MessageProps = {
  children: React.ReactNode;
  className?: string;
} & React.HTMLProps<HTMLDivElement>;

const Message = ({ children, className, ...props }: MessageProps) => (
  <div className={cn("flex gap-3", className)} {...props}>
    {children}
  </div>
);

export type MessageAvatarProps = {
  src: string;
  alt: string;
  fallback?: string;
  delayMs?: number;
  className?: string;
  imageClassName?: string;
};

const MessageAvatar = ({
  src,
  alt,
  fallback,
  delayMs,
  className,
  imageClassName,
}: MessageAvatarProps) => {
  return (
    <Avatar
      className={cn(
        "h-7 w-7 md:h-9 md:w-9 shrink-0 ring-2 ring-background shadow-sm",
        className,
      )}
    >
      <AvatarImage
        src={src}
        alt={alt}
        className={cn("object-contain p-1 md:p-1.5", imageClassName)}
      />
      {fallback && (
        <AvatarFallback delayMs={delayMs}>{fallback}</AvatarFallback>
      )}
    </Avatar>
  );
};

export type MessageContentProps = {
  children: React.ReactNode;
  markdown?: boolean;
  parseIncompleteMarkdown?: boolean;
  className?: string;
} & React.ComponentProps<typeof Markdown> &
  React.HTMLProps<HTMLDivElement>;

const MessageContent = ({
  children,
  markdown = false,
  parseIncompleteMarkdown = false,
  className,
  style,
  ...props
}: MessageContentProps) => {
  const classNames = cn(
    "rounded-xl md:rounded-lg px-3 py-2 md:px-4 md:py-3 text-sm md:text-base text-foreground bg-secondary break-words leading-relaxed shadow-sm border border-border/50",
    className,
  );

  const combinedStyle: React.CSSProperties = {
    wordBreak: "break-word",
    overflowWrap: "anywhere" as React.CSSProperties["overflowWrap"],
    userSelect: "text",
    WebkitUserSelect: "text",
    ...style,
  };

  return markdown ? (
    <Markdown
      className={classNames}
      parseIncompleteMarkdown={parseIncompleteMarkdown}
      style={combinedStyle}
      {...props}
    >
      {children as string}
    </Markdown>
  ) : (
    <div className={classNames} style={combinedStyle} {...props}>
      {children}
    </div>
  );
};

export type MessageActionsProps = {
  children: React.ReactNode;
  className?: string;
} & React.HTMLProps<HTMLDivElement>;

const MessageActions = ({
  children,
  className,
  ...props
}: MessageActionsProps) => (
  <div
    className={cn("text-muted-foreground flex items-center gap-2", className)}
    {...props}
  >
    {children}
  </div>
);

export type MessageActionProps = {
  className?: string;
  tooltip: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
} & React.ComponentProps<typeof Tooltip>;

const MessageAction = ({
  tooltip,
  children,
  className,
  side = "top",
  ...props
}: MessageActionProps) => {
  return (
    <TooltipProvider>
      <Tooltip {...props}>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side} className={className}>
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export {
  Message,
  MessageAvatar,
  MessageContent,
  MessageActions,
  MessageAction,
};
