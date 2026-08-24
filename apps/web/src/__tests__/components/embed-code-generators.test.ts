import { describe, it, expect } from "@jest/globals";
import {
  generateWidgetHTML,
  generateWidgetReact,
  generateWindowHTML,
} from "@/components/embed/embedCodeGenerators";

const BASE = "https://app.example.edu";
const TOKEN = "tok_abc123";

describe("embed code generators — voice delegation", () => {
  it("widget HTML window iframe delegates the mic and tags the URL", () => {
    const html = generateWidgetHTML(BASE, TOKEN);
    expect(html).toContain(
      `src="${BASE}/embed/${TOKEN}/window?chatbox=false&withExitX=true&voice=1"`,
    );
    expect(html).toContain('allow="microphone;clipboard-read;clipboard-write"');
  });

  it("widget HTML button iframe does NOT request the mic", () => {
    const html = generateWidgetHTML(BASE, TOKEN);
    const buttonIframe = html.slice(
      html.indexOf(`/button?`),
      html.indexOf(`/window?`),
    );
    expect(buttonIframe).not.toContain("microphone");
  });

  it("widget React snippet delegates the mic and tags the URL", () => {
    const jsx = generateWidgetReact(BASE, TOKEN);
    expect(jsx).toContain(
      `src="${BASE}/embed/${TOKEN}/window?chatbox=false&withExitX=true&voice=1"`,
    );
    expect(jsx).toContain(
      'allow="microphone; clipboard-read; clipboard-write"',
    );
  });

  it("window-only HTML delegates the mic and tags the URL", () => {
    const html = generateWindowHTML(BASE, TOKEN);
    expect(html).toContain(
      `src="${BASE}/embed/${TOKEN}/window?chatbox=false&voice=1"`,
    );
    expect(html).toContain('allow="microphone;clipboard-read;clipboard-write"');
  });

  it("keeps clipboard delegation alongside the mic in every variant", () => {
    for (const snippet of [
      generateWidgetHTML(BASE, TOKEN),
      generateWidgetReact(BASE, TOKEN),
      generateWindowHTML(BASE, TOKEN),
    ]) {
      expect(snippet).toContain("clipboard-read");
      expect(snippet).toContain("clipboard-write");
    }
  });
});
