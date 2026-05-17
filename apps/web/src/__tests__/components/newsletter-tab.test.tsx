import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import React from "react";
import type { NewsletterContact } from "@/lib/email";

// ---------------------------------------------------------------------------
// ESM modules — jest.unstable_mockModule (sonner ships .mjs)
// ---------------------------------------------------------------------------
jest.unstable_mockModule("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.unstable_mockModule("@/lib/trpc", () => ({
  trpc: {
    newsletter: {
      listSubscribers: {
        useQuery: jest.fn(),
      },
      sendBroadcast: {
        useMutation: jest.fn(),
      },
    },
  },
}));

// ---------------------------------------------------------------------------
// Dynamic imports after mocks
// ---------------------------------------------------------------------------
const trpcMod = await import("@/lib/trpc");
const mockUseQuery = trpcMod.trpc.newsletter.listSubscribers
  .useQuery as jest.Mock;
const mockUseMutation = trpcMod.trpc.newsletter.sendBroadcast
  .useMutation as jest.Mock;

const { NewsletterTab } = await import("@/components/admin/tabs/NewsletterTab");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function setupQuery(
  overrides: {
    data?: NewsletterContact[];
    isLoading?: boolean;
    isError?: boolean;
  } = {},
) {
  mockUseQuery.mockReturnValue({
    data: overrides.data,
    isLoading: overrides.isLoading ?? false,
    isError: overrides.isError ?? false,
  });
}

function setupMutation() {
  mockUseMutation.mockReturnValue({ mutate: jest.fn(), isPending: false });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("NewsletterTab", () => {
  beforeEach(() => {
    setupQuery();
    setupMutation();
  });

  it("renders a loading skeleton while the query is in-flight", () => {
    setupQuery({ isLoading: true });

    const { container } = render(React.createElement(NewsletterTab));

    // TableSkeleton renders Skeleton divs with animate-pulse
    const skeletons = container.querySelectorAll("[class*='animate-pulse']");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows the empty-state message when there are no subscribers", () => {
    setupQuery({ data: [] });

    render(React.createElement(NewsletterTab));

    expect(screen.getByText(/no subscribers yet/i)).toBeDefined();
  });

  it("renders subscriber rows when data is present", () => {
    const subscriber: NewsletterContact = {
      id: "c-1",
      email: "alice@example.com",
      firstName: "Alice",
      lastName: "Smith",
      createdAt: "2024-01-15T00:00:00.000Z",
      unsubscribed: false,
    };
    setupQuery({ data: [subscriber] });

    render(React.createElement(NewsletterTab));

    expect(screen.getByText("alice@example.com")).toBeDefined();
    expect(screen.getByText(/alice smith/i)).toBeDefined();
    // Both the table column header and the badge say "Subscribed"
    expect(screen.getAllByText("Subscribed").length).toBeGreaterThanOrEqual(1);
  });

  it("shows Unsubscribed badge for contacts with unsubscribed=true", () => {
    const subscriber: NewsletterContact = {
      id: "c-2",
      email: "bob@example.com",
      firstName: null,
      lastName: null,
      createdAt: "2024-02-01T00:00:00.000Z",
      unsubscribed: true,
    };
    setupQuery({ data: [subscriber] });

    render(React.createElement(NewsletterTab));

    expect(screen.getByText("Unsubscribed")).toBeDefined();
  });

  it("renders a dash when subscriber has no name", () => {
    const subscriber: NewsletterContact = {
      id: "c-3",
      email: "carol@example.com",
      firstName: null,
      lastName: null,
      createdAt: "2024-03-01T00:00:00.000Z",
      unsubscribed: false,
    };
    setupQuery({ data: [subscriber] });

    render(React.createElement(NewsletterTab));

    expect(screen.getByText("—")).toBeDefined();
  });

  it("shows an error message when the subscriber query fails", () => {
    setupQuery({ isError: true });

    render(React.createElement(NewsletterTab));

    expect(screen.getByText(/failed to load/i)).toBeDefined();
  });

  it("disables the Send Newsletter button when the query errored", () => {
    setupQuery({ isError: true });

    render(React.createElement(NewsletterTab));

    const button = screen.getByRole("button", { name: /send newsletter/i });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });
});
