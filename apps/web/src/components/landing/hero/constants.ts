// Hero section constants
export const BACKGROUND_IMAGE = "/bgai.png";

export const MUTED_GREEN = "#157F3C"; // A desaturated, muted green

// Gradient overlay configuration
// Creates a white gradient that's strong at top/bottom, transparent in middle
export const GRADIENT_STOPS = [
  { position: 0, opacity: 0.6 }, // Top: strong white overlay
  { position: 15, opacity: 0.4 },
  { position: 25, opacity: 0.2 },
  { position: 40, opacity: 0 }, // Middle: fully transparent (image visible)
  { position: 60, opacity: 0 }, // Middle: fully transparent
  { position: 70, opacity: 0.1 }, // Bottom: gradual fade to white
  { position: 75, opacity: 0.25 },
  { position: 80, opacity: 0.4 },
  { position: 85, opacity: 0.55 },
  { position: 90, opacity: 0.7 },
  { position: 95, opacity: 0.85 },
  { position: 100, opacity: 1 }, // Bottom: fully white (blends with sections below)
] as const;
