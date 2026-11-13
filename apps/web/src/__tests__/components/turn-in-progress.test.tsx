import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import { createI18n } from "@/i18n/create-i18n";

/**
 * A turn refused because another one holds the session (#465): the student
 * sees the localized message and gets their draft back. Drives the real
 * shared-chat hook and chat input; only the network and the toast are stubbed.
 */

// jsdom has no structuredClone, which the AI SDK's chat state uses to snapshot
// messages. UI messages are plain JSON, so a JSON round trip is equivalent.
if (typeof globalThis.structuredClone === "undefined") {
  Object.assign(globalThis, {
    structuredClone: <T,>(value: T): T => JSON.parse(JSON.stringify(value)),
  });
}

const toastError = jest.fn();

jest.unstable_mockModule("sonner", () => ({
  toast: { error: toastError, warning: jest.fn(), success: jest.fn() },
}));
jest.unstable_mockModule("@/lib/trpc", () => ({
  trpc: {
    chatbot: {
      getByShareToken: {
        useQuery: () => ({
          data: { id: "chatbot-1", name: "Biology" },
          isLoading: false,
          error: null,
        }),
      },
    },
  },
}));

const { useChat } = await import("@/hooks/useChat");
const { ChatInput } = await import("@/components/chat/messages/ChatInput");
const { extractText } = await import("@/lib/chat/ui-messages");

/** The shared chat page's input, wired to the real hook, plus its transcript. */
function SharedChat() {
  const chat = useChat("share-token");
  return (
    <>
      <ul aria-label="transcript">
        {chat.messages.map((message) => (
          <li key={message.id}>{extractText(message.parts)}</li>
        ))}
      </ul>
      <ChatInput
        currentMessage={chat.currentMessage}
        setCurrentMessage={chat.setCurrentMessage}
        isStreaming={chat.isStreaming}
        onSendMessage={chat.handleSendMessage}
        onStopStreaming={chat.stop}
        voiceInputEnabled={false}
      />
    </>
  );
}

/** A failed chat response as the transport sees it: status plus `{ code }`. */
function routeError(status: number, code: string) {
  return { ok: false, status, text: async () => JSON.stringify({ code }) };
}

let respond: (response: ReturnType<typeof routeError>) => void;
const fetchMock = jest.fn<(url: string) => Promise<unknown>>();

beforeEach(() => {
  fetchMock.mockImplementation(
    () => new Promise((resolve) => (respond = resolve)),
  );
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

const QUESTION = "What is photosynthesis?";

function renderChat(locale: "en" | "fr") {
  const catalog = locale === "fr" ? fr : en;
  render(
    <I18nextProvider i18n={createI18n(locale, catalog, en)}>
      <SharedChat />
    </I18nextProvider>,
  );
  return {
    catalog,
    input: screen.getByRole("textbox", { name: catalog.chat.input.ariaLabel }),
    transcript: screen.getByRole("list", { name: "transcript" }),
  };
}

async function send(text: string, catalog: typeof en) {
  const user = userEvent.setup();
  await user.type(
    screen.getByRole("textbox", { name: catalog.chat.input.ariaLabel }),
    text,
  );
  await user.click(
    screen.getByRole("button", { name: catalog.chat.input.send }),
  );
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  return user;
}

describe("a turn refused while another is in progress", () => {
  it.each(["en", "fr"] as const)(
    "shows the %s message and gives the draft back",
    async (locale) => {
      const { catalog, input, transcript } = renderChat(locale);
      await send(QUESTION, catalog);
      expect(fetchMock.mock.calls[0]![0]).toBe("/api/chat/shared");
      // Sent: the input clears and the message shows optimistically.
      expect(input).toHaveValue("");
      expect(transcript).toHaveTextContent(QUESTION);

      respond(routeError(409, "turn_in_progress"));

      await waitFor(() =>
        expect(toastError).toHaveBeenCalledWith(
          catalog.errors.chat.turnInProgress,
        ),
      );
      await waitFor(() => expect(input).toHaveValue(QUESTION));
      expect(transcript).toBeEmptyDOMElement();
    },
  );

  it("keeps a new draft typed while the request was refused", async () => {
    const { catalog, input, transcript } = renderChat("en");
    const user = await send(QUESTION, catalog);
    await user.type(input, "And respiration?");

    respond(routeError(409, "turn_in_progress"));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    await waitFor(() => expect(transcript).toBeEmptyDOMElement());
    expect(input).toHaveValue("And respiration?");
  });

  it("leaves the transcript and input alone for other errors", async () => {
    const { catalog, input, transcript } = renderChat("en");
    await send(QUESTION, catalog);

    respond(routeError(429, "rate_limited"));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        catalog.errors.chat.tooManyMessages,
      ),
    );
    expect(transcript).toHaveTextContent(QUESTION);
    expect(input).toHaveValue("");
  });
});
