import { describe, it, expect, afterEach } from "@jest/globals";
import {
  DEFAULT_DONATION_URL,
  contactHref,
  getDonationUrl,
} from "@/lib/support-links";

const originalDonationUrl = process.env.NEXT_PUBLIC_DONATION_URL;

afterEach(() => {
  if (originalDonationUrl === undefined) {
    delete process.env.NEXT_PUBLIC_DONATION_URL;
  } else {
    process.env.NEXT_PUBLIC_DONATION_URL = originalDonationUrl;
  }
});

describe("getDonationUrl", () => {
  it("defaults to the GoFundMe page", () => {
    delete process.env.NEXT_PUBLIC_DONATION_URL;
    expect(getDonationUrl()).toBe(DEFAULT_DONATION_URL);
    expect(DEFAULT_DONATION_URL).toBe(
      "https://www.gofundme.com/f/empower-educators-with-openaccess-ai",
    );
  });

  it("uses NEXT_PUBLIC_DONATION_URL when set", () => {
    process.env.NEXT_PUBLIC_DONATION_URL = "https://donate.example.org";
    expect(getDonationUrl()).toBe("https://donate.example.org");
  });

  it("ignores an empty NEXT_PUBLIC_DONATION_URL", () => {
    process.env.NEXT_PUBLIC_DONATION_URL = "";
    expect(getDonationUrl()).toBe(DEFAULT_DONATION_URL);
  });
});

describe("contactHref", () => {
  it("builds a mailto link", () => {
    expect(contactHref("admin@example.org")).toBe("mailto:admin@example.org");
  });
});
