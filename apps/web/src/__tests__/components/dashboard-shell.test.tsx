/**
 * @jest-environment-options {"customExportConditions": ["node", "node-addons"]}
 */
import { jest, describe, it, expect } from "@jest/globals";
import { act } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";

let sessionLoading = true;
const push = jest.fn();

jest.unstable_mockModule("@/lib/auth-client", () => ({
  useSession: () => ({
    data: sessionLoading ? null : { user: { id: "user-1" } },
    isPending: sessionLoading,
  }),
}));
jest.unstable_mockModule("next/navigation", () => ({
  useRouter: () => ({ push }),
}));
jest.unstable_mockModule("@/components/ui/skeletons", () => ({
  DashboardShellSkeleton: () => <div>Loading dashboard</div>,
}));
jest.unstable_mockModule("@/components/dashboard/DashboardHeader", () => ({
  DashboardHeader: () => <header>Dashboard header</header>,
}));
jest.unstable_mockModule("@/components/dashboard/DashboardSidebar", () => ({
  DashboardSidebar: () => <nav>Dashboard navigation</nav>,
}));
jest.unstable_mockModule("@/components/dashboard/MobileSidebarOverlay", () => ({
  MobileSidebarOverlay: () => null,
}));

const { DashboardShell } =
  await import("@/components/dashboard/DashboardShell");

describe("DashboardShell hydration", () => {
  it("hydrates the server skeleton when the session has already resolved in the browser", async () => {
    sessionLoading = true;
    const element = <DashboardShell>Dashboard content</DashboardShell>;
    const container = document.createElement("div");
    container.innerHTML = renderToString(element);
    document.body.appendChild(container);
    expect(container.textContent).toBe("Loading dashboard");

    // SessionTracker can finish loading before this streamed boundary hydrates.
    sessionLoading = false;
    const onRecoverableError = jest.fn();
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(container, element, { onRecoverableError });
      });
      expect(onRecoverableError).not.toHaveBeenCalled();
      expect(container.querySelector("header")?.textContent).toBe(
        "Dashboard header",
      );
      expect(container.querySelector("main")?.textContent).toBe(
        "Dashboard content",
      );
      expect(push).not.toHaveBeenCalled();
    } finally {
      await act(async () => root?.unmount());
      container.remove();
    }
  });
});
