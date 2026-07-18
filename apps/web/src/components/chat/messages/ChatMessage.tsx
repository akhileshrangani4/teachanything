"use client";

import { memo, useMemo } from "react";
import type { StudyUIMessage } from "@/server/chat/study-tools";
import { QuizMessage } from "./QuizMessage";
import { isRenderableQuiz } from "@/lib/quiz";
import {
  Message,
  MessageContent,
  MessageActions,
  MessageAction,
  MessageAvatar,
} from "@/components/ui/message";
import { CopyButton } from "@/components/ui/copy-button";
import { SourceBadge } from "@/components/ui/source-badge";
import { FileText, AlertTriangle } from "lucide-react";
import { dedupeSourcesByFileName } from "@/lib/message-sources";
import { extractText } from "@/server/chat/ui-messages";

interface ChatMessageProps {
  message: StudyUIMessage;
  showSources?: boolean;
  /** Render study-tool widgets read-only (professor dashboard viewer). */
  readOnly?: boolean;
}

/**
 * Shown when the model produced a malformed quiz whose input failed validation
 * (arrives as an `output-error` tool part). Without it the message renders
 * nothing at all -- a blank assistant bubble.
 */
function QuizErrorNotice() {
  return (
    <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-500 italic">
      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
      <span>Couldn&apos;t build the quiz. Try asking again.</span>
    </div>
  );
}

export function isVisiblePart(part: StudyUIMessage["parts"][number]): boolean {
  return (
    (part.type === "text" && part.text.trim().length > 0) ||
    (part.type === "tool-showQuiz" &&
      (part.state === "input-available" ||
        part.state === "output-available" ||
        part.state === "output-error")) ||
    (part.type === "dynamic-tool" &&
      part.toolName === "showQuiz" &&
      part.state === "output-error")
  );
}

function ChatMessageImpl({
  message,
  showSources = false,
  readOnly = false,
}: ChatMessageProps) {
  const isUser = message.role === "user";
  const sources = useMemo(
    () => dedupeSourcesByFileName(message.metadata?.sources ?? []),
    [message.metadata?.sources],
  );
  const truncated = message.metadata?.truncated;
  const textContent = extractText(message.parts);
  const hasContent = textContent.trim().length > 0;
  const hasVisiblePart = message.parts.some(isVisiblePart);

  if (
    !isUser &&
    !hasVisiblePart &&
    !truncated &&
    !(showSources && sources.length > 0)
  ) {
    return null;
  }

  if (isUser) {
    return (
      <div className="flex justify-end group">
        <div className="flex flex-col items-end gap-1 md:gap-2 max-w-[85%] md:max-w-[80%] min-w-0">
          <MessageContent
            markdown={false}
            className="bg-primary/10 text-foreground whitespace-pre-wrap shadow-xs border border-primary/20"
          >
            {textContent}
          </MessageContent>
          <MessageActions className="opacity-0 group-hover:opacity-100 transition-opacity">
            <MessageAction tooltip="Copy message">
              <CopyButton
                text={textContent}
                successMessage="Message copied to clipboard"
                errorMessage="Failed to copy message"
              />
            </MessageAction>
          </MessageActions>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 md:gap-2 max-w-[90%] md:max-w-[85%] min-w-0 group">
      <Message className="items-start gap-2 md:gap-3">
        <MessageAvatar
          src="/logo.svg"
          alt="Teach Anything™"
          imageClassName="grayscale"
        />
        <div className="flex-1 min-w-0 space-y-2">
          {message.parts.map((part, index) => {
            switch (part.type) {
              case "text":
                return (
                  <MessageContent
                    key={index}
                    markdown={true}
                    // The in-flight assistant message streams in place, so
                    // text can be mid-token incomplete Markdown (unclosed
                    // bold/code fences). Harmless on completed text.
                    parseIncompleteMarkdown={true}
                    className="bg-secondary"
                  >
                    {part.text}
                  </MessageContent>
                );
              case "tool-showQuiz":
                // Render once the model has finished filling the input.
                if (
                  part.state === "input-available" ||
                  part.state === "output-available"
                ) {
                  // A structurally valid quiz can still carry an out-of-range
                  // correct_index (the schema can't upper-bound it; see
                  // isRenderableQuiz). That would render an unwinnable quiz with
                  // no correct option, so show the same notice as a malformed one.
                  if (!isRenderableQuiz(part.input)) {
                    return <QuizErrorNotice key={part.toolCallId} />;
                  }
                  return (
                    <QuizMessage
                      key={part.toolCallId}
                      quiz={part.input}
                      readOnly={readOnly}
                    />
                  );
                }
                // The model produced a malformed quiz (input failed validation
                // -> output-error). Surface a notice instead of a blank bubble.
                if (part.state === "output-error") {
                  return <QuizErrorNotice key={part.toolCallId} />;
                }
                // input-streaming: the typing indicator covers the gap.
                return null;
              case "dynamic-tool":
                // A tool call the provider returned atomically (no preceding
                // input-start) lands as a `dynamic-tool` part. A valid quiz
                // renders as `tool-showQuiz` above; only the invalid case (which
                // the SDK flags dynamic) reaches here -- show the same notice
                // rather than a blank bubble.
                if (
                  part.toolName === "showQuiz" &&
                  part.state === "output-error"
                ) {
                  return <QuizErrorNotice key={part.toolCallId} />;
                }
                return null;
              default:
                // Retrieval tool parts, reasoning, step markers, etc. are not
                // rendered (retrieval RESULTS are filtered server-side; their
                // inputs only feed the status line).
                return null;
            }
          })}

          {truncated && (
            <div className="mt-1.5 md:mt-2 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-500 italic">
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
              <span>
                Response was cut off at the token limit. Try raising max tokens
                or asking a shorter question.
              </span>
            </div>
          )}

          {showSources && sources.length > 0 && (
            <div className="mt-2 md:mt-3 flex flex-wrap gap-1.5 md:gap-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="font-medium">Sources:</span>
              </div>
              {sources.map((source, index) => (
                <SourceBadge
                  key={index}
                  source={source}
                  variant="outline"
                  showSimilarityTooltip
                  className="text-xs font-normal"
                />
              ))}
            </div>
          )}
        </div>
      </Message>
      {hasContent && (
        <div className="pl-9 md:pl-12">
          <MessageActions className="opacity-0 group-hover:opacity-100 transition-opacity">
            <MessageAction tooltip="Copy message">
              <CopyButton
                text={textContent}
                successMessage="Message copied to clipboard"
                errorMessage="Failed to copy message"
              />
            </MessageAction>
          </MessageActions>
        </div>
      )}
    </div>
  );
}

export const ChatMessage = memo(ChatMessageImpl);
