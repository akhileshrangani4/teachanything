import {
  jest,
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
} from "@jest/globals";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import { createI18n } from "@/i18n/create-i18n";

const mockMutate = jest.fn();
let preferredLocale: string | null;

jest.unstable_mockModule("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ auth: { getProfile: { invalidate: async () => {} } } }),
    auth: {
      getProfile: {
        useQuery: () => ({ data: { id: "user-1", preferredLocale } }),
      },
      updatePreferredLocale: {
        useMutation: () => ({ mutate: mockMutate, isPending: false }),
      },
    },
  },
}));
jest.unstable_mockModule("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {} }),
}));

const { LanguageMenu } = await import("@/components/dashboard/LanguageMenu");

function renderMenu(i18n = createI18n("en", en)) {
  render(
    <I18nextProvider i18n={i18n}>
      <LanguageMenu />
    </I18nextProvider>,
  );
}

async function openMenuAndChoose(name: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Language" }));
  await user.click(await screen.findByRole("menuitemradio", { name }));
}

describe("LanguageMenu", () => {
  beforeAll(() => {
    // Radix menus call these; jsdom does not implement them.
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.scrollIntoView = () => {};
  });

  beforeEach(() => {
    mockMutate.mockClear();
    preferredLocale = null;
  });

  it("shows the current language by its own name", () => {
    renderMenu(createI18n("fr", fr, en));
    expect(screen.getByText("Français")).toBeTruthy();
  });

  it("saves a language chosen from the menu", async () => {
    renderMenu();
    await openMenuAndChoose("Español");
    expect(mockMutate).toHaveBeenCalledWith({ locale: "es" });
  });

  it("goes back to the browser's language", async () => {
    preferredLocale = "de";
    renderMenu();
    await openMenuAndChoose(en.settings.language.useBrowser);
    expect(mockMutate).toHaveBeenCalledWith({ locale: null });
  });

  it("does nothing when the saved language is chosen again", async () => {
    preferredLocale = "de";
    renderMenu();
    await openMenuAndChoose("Deutsch");
    expect(mockMutate).not.toHaveBeenCalled();
  });
});
