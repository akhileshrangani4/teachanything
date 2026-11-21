import { describe, it, expect } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import { createI18n } from "@/i18n/create-i18n";
import { SupportCard } from "@/components/dashboard/chatbots/SupportCard";
import { DEFAULT_DONATION_URL } from "@/lib/support-links";
import { DEFAULT_SUPPORT_EMAIL } from "@/lib/constants/support-email";

function renderCard(locale: "en" | "fr", catalog: typeof en) {
  return render(
    <I18nextProvider i18n={createI18n(locale, catalog)}>
      <SupportCard />
    </I18nextProvider>,
  );
}

describe("SupportCard", () => {
  it("links Donate to the donation page in a new tab, and Contact us to the admin", () => {
    delete process.env.NEXT_PUBLIC_DONATION_URL;
    delete process.env.NEXT_PUBLIC_CONTACT_EMAIL;
    renderCard("en", en);
    const labels = en.chatbots.support;

    expect(screen.getByText(labels.title)).toBeTruthy();
    expect(screen.getByText(labels.description)).toBeTruthy();
    const donate = screen.getByRole("link", { name: labels.donate });
    expect(donate.getAttribute("href")).toBe(DEFAULT_DONATION_URL);
    expect(donate.getAttribute("target")).toBe("_blank");
    expect(donate.getAttribute("rel")).toContain("noopener");
    const contact = screen.getByRole("link", { name: labels.contact });
    expect(contact.getAttribute("href")).toBe(
      `mailto:${DEFAULT_SUPPORT_EMAIL}`,
    );
    expect(DEFAULT_SUPPORT_EMAIL).toBe("admin@teachanything.ai");
  });

  it("shows translated labels", () => {
    renderCard("fr", fr);
    const labels = fr.chatbots.support;
    expect(screen.getByRole("link", { name: labels.donate })).toBeTruthy();
    expect(screen.getByRole("link", { name: labels.contact })).toBeTruthy();
    expect(labels.donate).not.toBe(en.chatbots.support.donate);
  });
});
