import { randomUUID } from "node:crypto";
import { createUIMessageStream } from "ai";
import type { StudyUIMessage } from "./study-tools";

type AssistantStreamOptions = Omit<
  Parameters<typeof createUIMessageStream<StudyUIMessage>>[0],
  "generateId"
>;

/**
 * `createUIMessageStream` with the assistant message id minted as a UUID.
 *
 * The SDK sends this id to the client in the stream's `start` chunk and hands
 * the same id to `onFinish` as `responseMessage.id`, which `persistTurn` writes
 * as the `messages` row's primary key. Its default generator makes 16-char ids
 * that don't fit that uuid column, so the row used to get a random id of its
 * own and the message on the student's screen couldn't be found server-side
 * (e.g. to rate it).
 */
export function createAssistantMessageStream(options: AssistantStreamOptions) {
  return createUIMessageStream<StudyUIMessage>({
    ...options,
    generateId: randomUUID,
  });
}
