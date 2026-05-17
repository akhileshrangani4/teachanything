import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";

// ---------------------------------------------------------------------------
// ESM modules — jest.unstable_mockModule (framer-motion ships .mjs)
// Strip framer-motion-specific props so they don't pollute the real DOM.
// ---------------------------------------------------------------------------
const MOTION_PROPS = new Set([
  "initial",
  "animate",
  "exit",
  "whileInView",
  "viewport",
  "transition",
  "variants",
  "whileHover",
  "whileTap",
]);

function stripMotionProps(
  props: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(props).filter(([key]) => !MOTION_PROPS.has(key)),
  );
}

jest.unstable_mockModule("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: Record<string, unknown>) =>
      React.createElement(
        "div",
        stripMotionProps(props),
        children as React.ReactNode,
      ),
    p: ({ children, ...props }: Record<string, unknown>) =>
      React.createElement(
        "p",
        stripMotionProps(props),
        children as React.ReactNode,
      ),
  },
}));

jest.unstable_mockModule("@/lib/trpc", () => ({
  trpc: {
    newsletter: {
      subscribe: {
        useMutation: jest.fn(),
      },
    },
  },
}));

// ---------------------------------------------------------------------------
// Dynamic imports after mocks
// ---------------------------------------------------------------------------
const trpcMod = await import("@/lib/trpc");
const mockUseMutation = trpcMod.trpc.newsletter.subscribe
  .useMutation as jest.Mock;

const { default: NewsletterSignup } =
  await import("@/components/landing/NewsletterSignup");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function setupMutation({
  mutate = jest.fn(),
  isPending = false,
}: {
  mutate?: jest.Mock;
  isPending?: boolean;
} = {}) {
  mockUseMutation.mockReturnValue({ mutate, isPending });
}

function getForm(container: HTMLElement): HTMLFormElement {
  return container.querySelector("form") as HTMLFormElement;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("NewsletterSignup", () => {
  beforeEach(() => {
    setupMutation();
  });

  it("renders the email input and subscribe button", () => {
    render(React.createElement(NewsletterSignup));

    expect(screen.getByRole("textbox", { name: /email/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /subscribe/i })).toBeDefined();
  });

  it("shows a validation error for an invalid email address", () => {
    const { container } = render(React.createElement(NewsletterSignup));

    fireEvent.change(screen.getByRole("textbox", { name: /email/i }), {
      target: { value: "not-an-email" },
    });
    fireEvent.submit(getForm(container));

    expect(screen.getByText(/valid email/i)).toBeDefined();
  });

  it("shows a validation error when the email field is empty", () => {
    const { container } = render(React.createElement(NewsletterSignup));

    fireEvent.submit(getForm(container));

    expect(screen.getByText(/valid email/i)).toBeDefined();
  });

  it("calls trpc subscribe.mutate with the trimmed email", () => {
    const mutate = jest.fn();
    setupMutation({ mutate });

    const { container } = render(React.createElement(NewsletterSignup));

    fireEvent.change(screen.getByRole("textbox", { name: /email/i }), {
      target: { value: "  user@example.com  " },
    });
    fireEvent.submit(getForm(container));

    expect(mutate).toHaveBeenCalledWith({ email: "user@example.com" });
  });

  it("disables the button while a request is pending", () => {
    setupMutation({ isPending: true });

    render(React.createElement(NewsletterSignup));

    const button = screen.getByRole("button", { name: /subscribing/i });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows a success message when onSuccess is triggered", () => {
    let capturedOnSuccess: (() => void) | undefined;
    mockUseMutation.mockImplementation(
      ({ onSuccess }: { onSuccess: () => void }) => {
        capturedOnSuccess = onSuccess;
        return { mutate: jest.fn(), isPending: false };
      },
    );

    render(React.createElement(NewsletterSignup));

    act(() => {
      capturedOnSuccess!();
    });

    expect(screen.getByText(/subscribed|thank you/i)).toBeDefined();
  });

  it("shows an error message when onError is triggered", () => {
    let capturedOnError: (() => void) | undefined;
    mockUseMutation.mockImplementation(
      ({ onError }: { onError: () => void }) => {
        capturedOnError = onError;
        return { mutate: jest.fn(), isPending: false };
      },
    );

    render(React.createElement(NewsletterSignup));

    act(() => {
      capturedOnError!();
    });

    expect(screen.getByText(/failed to subscribe/i)).toBeDefined();
  });
});
