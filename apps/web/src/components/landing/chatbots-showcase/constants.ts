// Shared constants for the landing page featured chatbots showcase.

// Rotating background images assigned to cards by index.
export const backgroundImages = [
  "/assets/featured chatbots bg/1.jpg",
  "/assets/featured chatbots bg/2.jpg",
  "/assets/featured chatbots bg/3.jpg",
  "/assets/featured chatbots bg/4.jpg",
] as const;

// Responsive grid class based on how many chatbots are shown.
export function getGridClassName(chatbotCount: number): string {
  return `grid gap-6 ${
    chatbotCount === 2
      ? "grid-cols-1 md:grid-cols-2"
      : chatbotCount === 3
        ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
        : "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
  }`;
}
