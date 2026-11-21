/**
 * @jest-environment node
 */
import { jest, describe, it, expect } from "@jest/globals";
import { render } from "@react-email/render";

const queued: { subject: string; reactComponent: React.ReactElement }[] = [];
jest.unstable_mockModule("@/server/email/delivery", () => ({
  queueEmail: async (params: {
    subject: string;
    reactComponent: React.ReactElement;
  }) => {
    queued.push(params);
    return { deliveryId: "d-1" };
  },
}));
jest.unstable_mockModule("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_APP_URL: "https://app.example.org",
    NEXT_PUBLIC_CONTACT_EMAIL: "help@example.org",
  },
  getAdminEmails: () => ["admin@example.org"],
}));

const { sendDailyLimitWarningEmail } =
  await import("@/server/email/daily-limit-warning");

const base = { to: "ada@example.edu", name: "Ada Lovelace" };

/** Queue one email and return its subject and rendered HTML. */
async function sendAndRender(
  params: Omit<Parameters<typeof sendDailyLimitWarningEmail>[0], "to" | "name">,
) {
  queued.length = 0;
  await sendDailyLimitWarningEmail({ ...base, ...params });
  const [email] = queued;
  return { subject: email!.subject, html: await render(email!.reactComponent) };
}

describe("sendDailyLimitWarningEmail", () => {
  it("renders the chatbot 80% heads-up with the key facts and links", async () => {
    const { subject, html } = await sendAndRender({
      chatbotName: "Biology",
      count: 120,
      limit: 150,
      threshold: 80,
    });
    expect(subject).toBe(
      'Heads-up: "Biology" has used 80% of today\'s messages',
    );
    expect(html).toContain("Hello Ada Lovelace,");
    expect(html).toContain("Biology");
    expect(html).toContain("120 of its 150 daily student messages");
    expect(html).toContain("midnight US Eastern time");
    expect(html).toContain("expecting a large class session");
    expect(html).toContain("mailto:help@example.org");
    expect(html).toContain("https://app.example.org/dashboard");
    expect(html).toContain(
      "https://app.example.org/docs/instructors/daily-message-limits",
    );
  });

  it("renders the professor-total 100% email with the student message", async () => {
    const { html } = await sendAndRender({
      chatbotName: null,
      count: 300,
      limit: 300,
      threshold: 100,
    });
    expect(html).toContain("All of your chatbots together");
    expect(html).toContain("daily limit of 300 student messages");
    expect(html).toContain(
      "Students will see the daily-limit message until midnight US Eastern time",
    );
  });
});
