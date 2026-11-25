import { describe, it, expect } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import { EmailPreview } from "@/components/admin/tabs/pending-users-tab/email-preview";
import { REGISTRATION_EMAIL_BODIES } from "@/lib/registration-email-templates";

describe("EmailPreview", () => {
  it.each(["request_more_info", "incorrect_info"] as const)(
    "shows the full %s text addressed to the recipient",
    (templateId) => {
      render(
        <EmailPreview
          templateId={templateId}
          recipientName="Dana Lee"
          customMessage=""
        />,
      );
      const body = REGISTRATION_EMAIL_BODIES[templateId];
      expect(screen.getByText("Hi Dana Lee,")).toBeTruthy();
      for (const line of [
        body.intro,
        body.request,
        ...body.items,
        body.closing,
      ]) {
        expect(screen.getByText(line)).toBeTruthy();
      }
    },
  );

  it("shows the admin's own message for a custom email", () => {
    render(
      <EmailPreview
        templateId="generic_admin_message"
        recipientName="Dana Lee"
        customMessage="Please send your faculty page."
      />,
    );
    expect(screen.getByText("Please send your faculty page.")).toBeTruthy();
  });

  it("shows a placeholder until a custom message is written", () => {
    render(
      <EmailPreview
        templateId="generic_admin_message"
        recipientName="Dana Lee"
        customMessage="  "
      />,
    );
    expect(screen.getByText("Your message will appear here.")).toBeTruthy();
  });
});
