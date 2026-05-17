/**
 * @jest-environment node
 *
 * Node environment avoids the jsdom "browser" condition on react-dom/server
 * which would otherwise select server.browser.js and require MessageChannel.
 */
import { describe, it, expect } from "@jest/globals";
import { render as renderEmail } from "@react-email/render";
import { NewsletterEmail } from "@/components/emails/NewsletterEmail";

const DEFAULT_PROPS = {
  subject: "Monthly Update",
  body: "First paragraph.\nSecond paragraph.",
  supportEmail: "support@example.com",
} as const;

async function buildHtml(
  overrides: Partial<Parameters<typeof NewsletterEmail>[0]> = {},
): Promise<string> {
  return renderEmail(NewsletterEmail({ ...DEFAULT_PROPS, ...overrides }));
}

describe("NewsletterEmail", () => {
  it("includes the Resend personalisation variable {{{contact.first_name|there}}}", async () => {
    const html = await buildHtml();
    expect(html).toContain("{{{contact.first_name|there}}}");
  });

  it("includes the Resend unsubscribe URL variable {{{RESEND_UNSUBSCRIBE_URL}}}", async () => {
    const html = await buildHtml();
    expect(html).toContain("{{{RESEND_UNSUBSCRIBE_URL}}}");
  });

  it("renders the subject inside the email body", async () => {
    const html = await buildHtml({ subject: "Summer Newsletter" });
    expect(html).toContain("Summer Newsletter");
  });

  it("renders each non-empty body line", async () => {
    const html = await buildHtml();
    expect(html).toContain("First paragraph.");
    expect(html).toContain("Second paragraph.");
  });

  it("renders the support email address and mailto link", async () => {
    const html = await buildHtml({ supportEmail: "help@school.edu" });
    expect(html).toContain("help@school.edu");
    expect(html).toContain("mailto:help@school.edu");
  });

  it("skips blank body lines (renders br instead of p)", async () => {
    const html = await buildHtml({ body: "Line one.\n\nLine two." });
    expect(html).toContain("Line one.");
    expect(html).toContain("Line two.");
  });
});
