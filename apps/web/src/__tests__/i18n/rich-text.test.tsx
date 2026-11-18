/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nextProvider, Trans } from "react-i18next";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import { createI18n } from "@/i18n/create-i18n";

const french = createI18n("fr", fr, en);

function render(node: React.ReactNode) {
  return renderToStaticMarkup(
    <I18nextProvider i18n={french}>{node}</I18nextProvider>,
  );
}

describe("translated sentences with markup", () => {
  it("wraps the catalog's link text in the supplied link", () => {
    const html = render(
      <Trans
        i18nKey="auth.login.noAccount"
        components={{ a: <a href="/register" /> }}
      />,
    );
    expect(html).toMatch(/<a href="\/register">[^<]+<\/a>/);
    expect(html).not.toContain("<link>");
  });

  it("inserts values inside markup without leaving placeholders", () => {
    const html = render(
      <Trans
        i18nKey="auth.forgotPassword.checkEmailDescription"
        values={{ email: "a@b.edu" }}
        components={{ b: <span className="x" /> }}
      />,
    );
    expect(html).toContain('<span class="x">a@b.edu</span>');
    expect(html).not.toContain("{email}");
  });

  it("does not mangle a value that looks like HTML", () => {
    const html = render(
      <Trans
        i18nKey="chatbotDetail.embed.htmlWidgetHelp"
        values={{ tag: "</body>" }}
        components={{ code: <code /> }}
      />,
    );
    expect(html).toContain("<code>&lt;/body&gt;</code>");
  });
});

describe("placeholders in plain messages", () => {
  it("keeps a literal <name> value in the welcome help text", () => {
    expect(
      french.t("chatbotSettings.welcome.help", { name: "<name>" }),
    ).toContain("<name>");
  });

  it("formats plurals and selects", () => {
    expect(french.t("files.deleteDialog.title", { count: 3 })).toContain("3");
    expect(
      french.t("conversations.exportDialog.title", {
        mode: "selected",
        count: 2,
      }),
    ).toContain("2");
  });

  it("formats fractions as percentages", () => {
    expect(
      french.t("analytics.metrics.ragHitRateValue", { rate: 0.5 }),
    ).toMatch(/50\s*%/);
  });
});
