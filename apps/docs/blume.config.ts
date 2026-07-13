import { defineConfig } from "blume";

export default defineConfig({
  title: "Teach Anything",
  description:
    "Turn your course materials into an AI teaching assistant that answers your students' questions — no coding required.",

  // The main app lives at teachanything.ai and serves this static build under
  // /docs. `deployment.base` moves the whole site — pages AND assets — under
  // that subpath (unlike `basePath`, which would leave assets at the root and
  // collide with the main app). Everything ends up self-contained beneath
  // /docs, so the built `dist/` can drop straight into the app's public folder.
  deployment: {
    site: "https://teachanything.ai",
    base: "/docs",
  },

  // Brand mark from the main site (copied into public/logo.svg so the docs
  // bundle stays self-contained under /docs) plus the wordmark. A string path
  // to an SVG is inlined by Blume; the object form is only for raster art.
  // The brand link goes to the main product site, not the docs root.
  logo: {
    image: "/logo.svg",
    text: "Teach Anything",
    href: "https://teachanything.ai",
  },

  // Match the main site: green accent, warm off-white background, Inter body,
  // and the same 0.75rem corner radius. Headings use Geist — a crisp, modern
  // display sans that pairs cleanly with the Inter body.
  theme: {
    mode: "system",
    radius: "lg",
    accent: {
      light: "oklch(0.5248 0.1373 149.83)",
      dark: "oklch(0.7233 0.1939 149.39)",
    },
    background: {
      light: "oklch(0.986 0.0019 84.56)",
      dark: "oklch(0.2158 0.0206 264)",
    },
    fonts: {
      body: "inter",
      display: "geist",
    },
  },

  navigation: {
    // Persistent link back to the product, shown above the sidebar sections.
    featured: [
      {
        label: "Open Teach Anything",
        href: "https://teachanything.ai/dashboard",
        icon: "layout-dashboard",
      },
    ],
    tabs: [
      {
        label: "For Instructors",
        path: "/instructors",
        icon: "graduation-cap",
      },
      { label: "Tutorials", path: "/tutorials", icon: "compass" },
      { label: "For Students", path: "/students", icon: "book-open" },
    ],
  },

  // No landing page here — the marketing site owns the root, and the Next.js
  // app HTTP-redirects /docs → /docs/instructors (see apps/web/next.config.js).
  // We intentionally do NOT use a Blume redirect: it emits a meta-refresh HTML
  // page that briefly flashes "Redirecting to…" before navigating.

  // Per-page OG images, sitemap, robots, and JSON-LD are on by default (a
  // deployment `site` is set). No X/Twitter handle is configured because
  // Teach Anything doesn't have one — the share card still renders fine
  // without an attribution account.

  // "Was this helpful?" widget and last-updated stamps keep the docs honest.
  // (No `github` block, so there are no "Edit on GitHub" page actions or
  // header repo link — this is an end-user product site, not a repo.)
  feedback: true,
  lastModified: true,
});
