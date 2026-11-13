import { describe, it, expect } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import en from "../../../messages/en.json";
import { createI18n } from "@/i18n/create-i18n";
import { RatingsCard } from "@/components/chatbot/analytics-tab/ratings-card";
import {
  positiveRatingShare,
  type RatingsSummary,
} from "@/components/chatbot/analytics-tab/formatters";

const labels = en.analytics.ratings;

function renderCard(props: {
  isLoading: boolean;
  data: RatingsSummary | undefined;
}) {
  return render(
    <I18nextProvider i18n={createI18n("en", en)}>
      <RatingsCard {...props} />
    </I18nextProvider>,
  );
}

/** The value shown under a stat label (`<dt>` → sibling `<dd>`). */
function statValue(label: string): string | null {
  const term = screen.getByText(label, { selector: "dt" });
  return term.nextElementSibling?.textContent ?? null;
}

describe("positiveRatingShare", () => {
  it.each([
    [{ up: 3, down: 1 }, 0.75],
    [{ up: 0, down: 4 }, 0],
    [{ up: 2, down: 0 }, 1],
  ])("returns the thumbs-up share for %o", (summary, expected) => {
    expect(positiveRatingShare(summary)).toBe(expected);
  });

  it("returns null when nothing was rated", () => {
    expect(positiveRatingShare({ up: 0, down: 0 })).toBeNull();
  });
});

describe("RatingsCard", () => {
  it("shows thumbs up, thumbs down and % positive with the 30-day label", () => {
    renderCard({ isLoading: false, data: { up: 1234, down: 411 } });

    expect(screen.getByText(labels.title)).toBeTruthy();
    expect(screen.getByText(labels.period)).toBeTruthy();
    expect(statValue(labels.up)).toBe("1,234");
    expect(statValue(labels.down)).toBe("411");
    expect(statValue(labels.positive)).toBe("75%");
    expect(screen.queryByText(labels.empty)).toBeNull();
  });

  it("shows the empty state when there are no ratings", () => {
    renderCard({ isLoading: false, data: { up: 0, down: 0 } });

    expect(screen.getByText(labels.empty)).toBeTruthy();
    expect(screen.getByText(labels.emptyHint)).toBeTruthy();
    expect(screen.getByText(labels.period)).toBeTruthy();
    expect(screen.queryByText(labels.positive)).toBeNull();
  });

  it("shows the empty state when no data has arrived", () => {
    renderCard({ isLoading: false, data: undefined });
    expect(screen.getByText(labels.empty)).toBeTruthy();
  });

  it("shows skeletons instead of numbers while loading", () => {
    const { container } = renderCard({ isLoading: true, data: undefined });
    expect(screen.queryByText(labels.empty)).toBeNull();
    expect(screen.queryByText(labels.up)).toBeNull();
    expect(container.querySelectorAll(".animate-pulse").length).toBe(3);
  });
});
