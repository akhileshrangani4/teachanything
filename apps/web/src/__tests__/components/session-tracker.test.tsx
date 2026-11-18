import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { render } from "@testing-library/react";
import type { QueryClient } from "@tanstack/react-query";

type SessionState = {
  data: { user: { id: string } } | null;
  isPending: boolean;
};

const mockRefresh = jest.fn();
const mockClear = jest.fn();
let sessionState: SessionState;

jest.unstable_mockModule("@/lib/auth-client", () => ({
  useSession: () => sessionState,
}));
jest.unstable_mockModule("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

const { SessionTracker } = await import("@/components/SessionTracker");

const loading: SessionState = { data: null, isPending: true };
const signedOut: SessionState = { data: null, isPending: false };
const signedInAs = (id: string): SessionState => ({
  data: { user: { id } },
  isPending: false,
});

/** Renders the tracker through each session state, in order. */
function play(...states: SessionState[]) {
  const queryClient = { clear: mockClear } as unknown as QueryClient;
  sessionState = states[0]!;
  const { rerender } = render(<SessionTracker queryClient={queryClient} />);
  for (const state of states.slice(1)) {
    sessionState = state;
    rerender(<SessionTracker queryClient={queryClient} />);
  }
}

describe("SessionTracker", () => {
  beforeEach(() => {
    mockRefresh.mockClear();
    mockClear.mockClear();
  });

  it.each([
    ["signing in", [loading, signedOut, signedInAs("u1")]],
    ["signing out", [loading, signedInAs("u1"), signedOut]],
    ["switching accounts", [signedInAs("u1"), signedInAs("u2")]],
  ])("reloads server layouts and clears queries when %s", (_name, states) => {
    play(...states);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockClear).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["a signed-in page load", [loading, signedInAs("u1")]],
    ["a signed-out page load", [loading, signedOut]],
    ["a session refetch", [signedInAs("u1"), loading, signedInAs("u1")]],
  ])("does nothing on %s", (_name, states) => {
    play(...states);
    expect(mockRefresh).not.toHaveBeenCalled();
    expect(mockClear).not.toHaveBeenCalled();
  });
});
