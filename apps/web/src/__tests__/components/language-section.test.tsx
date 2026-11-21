import {
  jest,
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
} from "@jest/globals";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import en from "../../../messages/en.json";
import { createI18n } from "@/i18n/create-i18n";

const mockMutate = jest.fn();
let preferredLocale: string | null;

jest.unstable_mockModule("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ auth: { getProfile: { invalidate: async () => {} } } }),
    auth: {
      getProfile: {
        useQuery: () => ({
          data: { id: "user-1", preferredLocale },
          isLoading: false,
        }),
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

const { LanguageSection } =
  await import("@/components/dashboard/settings/LanguageSection");

const labels = en.settings.language;

function renderSection() {
  render(
    <I18nextProvider i18n={createI18n("en", en)}>
      <LanguageSection />
    </I18nextProvider>,
  );
}

async function choose(option: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("combobox"));
  await user.click(
    within(screen.getByRole("listbox")).getByRole("option", { name: option }),
  );
}

function saveButton() {
  return screen.getByRole("button", {
    name: labels.save,
  }) as HTMLButtonElement;
}

describe("LanguageSection", () => {
  beforeAll(() => {
    // Radix Select calls these; jsdom does not implement them.
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.scrollIntoView = () => {};
  });

  beforeEach(() => mockMutate.mockClear());

  it("lets a user with a saved language go back to the browser's", async () => {
    preferredLocale = "fr";
    renderSection();

    await choose(labels.useBrowser);
    await userEvent.setup().click(saveButton());

    expect(mockMutate).toHaveBeenCalledWith({ locale: null });
  });

  it("starts on the browser option when nothing is saved", () => {
    preferredLocale = null;
    renderSection();

    expect(screen.getByRole("combobox").textContent).toBe(labels.useBrowser);
    expect(saveButton().disabled).toBe(true);
  });

  it("saves a language picked from the browser option", async () => {
    preferredLocale = null;
    renderSection();

    await choose("Français");
    await userEvent.setup().click(saveButton());

    expect(mockMutate).toHaveBeenCalledWith({ locale: "fr" });
  });
});
