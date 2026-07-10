import type { StudyUIMessage } from "@/server/chat/study-tools";
import { extractText } from "@/server/chat/ui-messages";

/** Flatten a UIMessage into the plain { role, content, sources } shape export needs. */
function toExportRows(messages: StudyUIMessage[]) {
  return messages.map((message) => ({
    role: message.role,
    content: extractText(message.parts),
    sources: message.metadata?.sources,
  }));
}

/**
 * Exports chat messages as a formatted text file
 * @param messages - Array of chat messages to export
 * @param chatbotName - Name of the chatbot
 * @param includeSources - Whether to include source citations
 */
export function exportChatAsText(
  uiMessages: StudyUIMessage[],
  chatbotName: string,
  includeSources: boolean = true,
): void {
  if (uiMessages.length === 0) {
    return;
  }
  const messages = toExportRows(uiMessages);

  const date = new Date().toLocaleString();
  let content = `Chat Export: ${chatbotName}\n`;
  content += `Exported on: ${date}\n`;
  content += `${"=".repeat(60)}\n\n`;

  messages.forEach((message, index) => {
    const role = message.role === "user" ? "User" : "Assistant";
    content += `[${index + 1}] ${role}:\n`;
    content += `${message.content}\n`;

    // Include sources if available
    if (
      includeSources &&
      message.sources &&
      message.sources.length > 0 &&
      message.role === "assistant"
    ) {
      content += `\nSources:\n`;
      message.sources.forEach((source, sourceIndex) => {
        content += `  ${sourceIndex + 1}. ${source.fileName}`;
        if (source.similarity !== undefined) {
          content += ` (similarity: ${(source.similarity * 100).toFixed(1)}%)`;
        }
        content += `\n`;
      });
    }

    content += `\n${"-".repeat(60)}\n\n`;
  });

  // Create and download the file
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `chat-export-${chatbotName.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-${Date.now()}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports chat messages as JSON
 * @param messages - Array of chat messages to export
 * @param chatbotName - Name of the chatbot
 */
export function exportChatAsJSON(
  uiMessages: StudyUIMessage[],
  chatbotName: string,
): void {
  if (uiMessages.length === 0) {
    return;
  }
  const messages = toExportRows(uiMessages);

  const exportData = {
    chatbotName,
    exportedAt: new Date().toISOString(),
    messageCount: messages.length,
    messages: messages.map((message) => ({
      role: message.role,
      content: message.content,
      sources: message.sources,
    })),
  };

  const content = JSON.stringify(exportData, null, 2);
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `chat-export-${chatbotName.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
