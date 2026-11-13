import { jest, describe, it, expect } from "@jest/globals";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import en from "../../../messages/en.json";
import { createI18n } from "@/i18n/create-i18n";
import { CitationMarker } from "@/components/chat/messages/citation-marker";
import { CitationList } from "@/components/chat/messages/citation-list";
import type { Citation } from "@/lib/message-sources";

/**
 * The presentational citation pieces (#D4): the inline "[n]" marker and the
 * footnote list it points at. Props only, so these render the real components
 * with the real English catalog and stub nothing but the select callback.
 */

function renderWithI18n(ui: ReactNode) {
  return render(
    <I18nextProvider i18n={createI18n("en", en)}>{ui}</I18nextProvider>,
  );
}

const lecture: Citation = {
  ref: 1,
  fileName: "lecture-3.pdf",
  pageNumber: 4,
  excerpt: "Mitochondria produce ATP through oxidative phosphorylation.",
};
const syllabus: Citation = {
  ref: 2,
  fileName: "syllabus.docx",
  pageNumber: null,
  excerpt: "Late work loses ten percent per day.",
};

describe("CitationMarker", () => {
  it("is a superscript button named for its source", () => {
    renderWithI18n(
      <CitationMarker refNumber={2} active={false} onSelect={() => {}} />,
    );
    const marker = screen.getByRole("button", { name: "Source 2" });
    expect(marker).toHaveTextContent("2");
    expect(marker.closest("sup")).not.toBeNull();
  });

  it("calls onSelect with its number on click", async () => {
    const onSelect = jest.fn();
    renderWithI18n(
      <CitationMarker refNumber={3} active={false} onSelect={onSelect} />,
    );
    await userEvent.setup().click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(3);
  });

  it.each(["{Enter}", " "])(
    "activates from the keyboard with %j",
    async (key) => {
      const onSelect = jest.fn();
      renderWithI18n(
        <CitationMarker refNumber={5} active={false} onSelect={onSelect} />,
      );
      const user = userEvent.setup();
      await user.tab();
      expect(screen.getByRole("button")).toHaveFocus();
      await user.keyboard(key);
      expect(onSelect).toHaveBeenCalledWith(5);
    },
  );

  it("marks itself current only when active", () => {
    const { rerender } = renderWithI18n(
      <CitationMarker refNumber={1} active={false} onSelect={() => {}} />,
    );
    expect(screen.getByRole("button")).not.toHaveAttribute("aria-current");

    rerender(
      <I18nextProvider i18n={createI18n("en", en)}>
        <CitationMarker refNumber={1} active onSelect={() => {}} />
      </I18nextProvider>,
    );
    const marker = screen.getByRole("button");
    expect(marker).toHaveAttribute("aria-current", "true");
    // The visual state is the filled badge variant.
    expect(marker).toHaveClass("bg-primary");
  });
});

describe("CitationList", () => {
  function footnote(ref: number): HTMLElement {
    const item = screen
      .getAllByRole("listitem")
      .find((li) => li.dataset.citationRef === String(ref));
    if (!item) throw new Error(`No footnote for [${ref}]`);
    return item;
  }

  it("renders nothing for no citations", () => {
    const { container } = renderWithI18n(
      <CitationList citations={[]} activeRef={null} onSelect={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("numbers each footnote with its file and page, in the given order", () => {
    renderWithI18n(
      <CitationList
        citations={[lecture, syllabus]}
        activeRef={null}
        onSelect={() => {}}
      />,
    );
    const list = screen.getByRole("region", { name: "Cited sources" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);

    expect(
      within(items[0]!).getByRole("button", { name: "Source 1" }),
    ).toBeInTheDocument();
    expect(items[0]).toHaveTextContent("lecture-3.pdf");
    expect(items[0]).toHaveTextContent("Page 4");

    expect(
      within(items[1]!).getByRole("button", { name: "Source 2" }),
    ).toBeInTheDocument();
    expect(items[1]).toHaveTextContent("syllabus.docx");
    // No page number, so no page label.
    expect(items[1]).not.toHaveTextContent(/Page/);
  });

  it("shows web sources by host without a page", () => {
    renderWithI18n(
      <CitationList
        citations={[
          { ref: 1, fileName: "Web: example.edu", pageNumber: 2, excerpt: "x" },
        ]}
        activeRef={null}
        onSelect={() => {}}
      />,
    );
    expect(footnote(1)).toHaveTextContent("example.edu");
    expect(footnote(1)).not.toHaveTextContent("Web:");
    expect(footnote(1)).not.toHaveTextContent(/Page/);
  });

  it("links to the file only when a fileId is present", () => {
    renderWithI18n(
      <CitationList
        citations={[
          { ...lecture, fileId: "file-abc" },
          syllabus,
          { ...syllabus, ref: 3, fileId: "file-xyz" },
        ]}
        activeRef={null}
        onSelect={() => {}}
      />,
    );
    const pageLink = within(footnote(1)).getByRole("link", {
      name: "Open page 4",
    });
    expect(pageLink).toHaveAttribute(
      "href",
      "/api/files/file-abc/download#page=4",
    );
    expect(pageLink).toHaveAttribute("target", "_blank");
    expect(pageLink).toHaveAttribute("rel", "noopener noreferrer");

    // A student surface: no fileId, so no way to reach the file.
    expect(within(footnote(2)).queryByRole("link")).toBeNull();

    // Owner surface, but no page to jump to: the file itself.
    expect(
      within(footnote(3)).getByRole("link", { name: "Open file" }),
    ).toHaveAttribute("href", "/api/files/file-xyz/download");
  });

  it("folds the excerpt away until toggled from the keyboard", async () => {
    renderWithI18n(
      <CitationList
        citations={[lecture]}
        activeRef={null}
        onSelect={() => {}}
      />,
    );
    const toggle = screen.getByRole("button", { name: "Show excerpt" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(lecture.excerpt)).toBeNull();

    const user = userEvent.setup();
    toggle.focus();
    await user.keyboard("{Enter}");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveAccessibleName("Hide excerpt");
    expect(screen.getByText(lecture.excerpt)).toBeVisible();

    await user.keyboard(" ");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(lecture.excerpt)).toBeNull();
  });

  it("marks the active footnote and reports selection by number", async () => {
    const onSelect = jest.fn();
    renderWithI18n(
      <CitationList
        citations={[lecture, syllabus]}
        activeRef={2}
        onSelect={onSelect}
      />,
    );
    const active = within(footnote(2)).getByRole("button", {
      name: "Source 2",
    });
    expect(active).toHaveAttribute("aria-current", "true");
    expect(footnote(2)).toHaveAttribute("data-active", "true");
    expect(
      within(footnote(1)).getByRole("button", { name: "Source 1" }),
    ).not.toHaveAttribute("aria-current");
    expect(footnote(1)).not.toHaveAttribute("data-active");

    await userEvent
      .setup()
      .click(within(footnote(1)).getByRole("button", { name: "Source 1" }));
    expect(onSelect).toHaveBeenCalledWith(1);
  });
});
