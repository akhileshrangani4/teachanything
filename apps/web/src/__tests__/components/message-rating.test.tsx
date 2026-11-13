import { jest, describe, it, expect } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import { createI18n } from "@/i18n/create-i18n";
import {
  MessageRating,
  type MessageRatingValue,
} from "@/components/chat/messages/MessageRating";

const labels = en.chat.message.rating;

function renderRating(
  props: { value: MessageRatingValue | null; disabled?: boolean },
  i18n = createI18n("en", en),
) {
  const onRate = jest.fn<(rating: MessageRatingValue) => void>();
  render(
    <I18nextProvider i18n={i18n}>
      <MessageRating {...props} onRate={onRate} />
    </I18nextProvider>,
  );
  return {
    onRate,
    up: screen.getByRole("button", { name: labels.up }),
    down: screen.getByRole("button", { name: labels.down }),
  };
}

describe("MessageRating", () => {
  it("groups both buttons under a localized label", () => {
    renderRating({ value: null });
    expect(screen.getByRole("group", { name: labels.group })).toBeTruthy();
  });

  it("shows neither button pressed when unrated, and rates on click", async () => {
    const { onRate, up, down } = renderRating({ value: null });
    expect(up.getAttribute("aria-pressed")).toBe("false");
    expect(down.getAttribute("aria-pressed")).toBe("false");

    await userEvent.click(up);
    await userEvent.click(down);
    expect(onRate.mock.calls).toEqual([["up"], ["down"]]);
  });

  it("marks thumbs up pressed and lets the student switch to down", async () => {
    const { onRate, up, down } = renderRating({ value: "up" });
    expect(up.getAttribute("aria-pressed")).toBe("true");
    expect(down.getAttribute("aria-pressed")).toBe("false");

    await userEvent.click(up);
    expect(onRate).not.toHaveBeenCalled();
    await userEvent.click(down);
    expect(onRate).toHaveBeenCalledWith("down");
  });

  it("marks thumbs down pressed and lets the student switch to up", async () => {
    const { onRate, up, down } = renderRating({ value: "down" });
    expect(down.getAttribute("aria-pressed")).toBe("true");
    expect(up.getAttribute("aria-pressed")).toBe("false");

    await userEvent.click(down);
    expect(onRate).not.toHaveBeenCalled();
    await userEvent.click(up);
    expect(onRate).toHaveBeenCalledWith("up");
  });

  it("disables both buttons and ignores clicks when disabled", async () => {
    const { onRate, up, down } = renderRating({ value: null, disabled: true });
    expect((up as HTMLButtonElement).disabled).toBe(true);
    expect((down as HTMLButtonElement).disabled).toBe(true);

    await userEvent.click(up);
    await userEvent.click(down);
    expect(onRate).not.toHaveBeenCalled();
  });

  it("uses the active locale for its labels", () => {
    render(
      <I18nextProvider i18n={createI18n("fr", fr, en)}>
        <MessageRating value={null} onRate={() => {}} />
      </I18nextProvider>,
    );
    const frLabels = fr.chat.message.rating;
    expect(screen.getByRole("group", { name: frLabels.group })).toBeTruthy();
    expect(screen.getByRole("button", { name: frLabels.up })).toBeTruthy();
    expect(screen.getByRole("button", { name: frLabels.down })).toBeTruthy();
  });
});
