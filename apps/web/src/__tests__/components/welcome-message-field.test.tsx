/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nextProvider } from "react-i18next";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import { createI18n } from "@/i18n/create-i18n";
import { WelcomeMessageField } from "@/components/chat/settings/welcome-message-field";

describe("WelcomeMessageField", () => {
  it("shows the default greeting in the owner's language", () => {
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={createI18n("fr", fr, en)}>
        <WelcomeMessageField value="" onChange={() => {}} isEditing={false} />
      </I18nextProvider>,
    );

    expect(html).toContain(fr.chat.interface.emptyPrompt);
    expect(html).not.toContain(en.chat.interface.emptyPrompt);
  });
});
