import {
  isMatchingRequest,
  matchingSchema,
  MATCHING_SYSTEM_INSTRUCTION,
  type Matching,
} from "@/lib/matching";
import type { StructuredMode } from "./types";

export const matchingMode: StructuredMode<Matching> = {
  id: "matching",
  label: "matching game",
  detect: isMatchingRequest,
  canonicalTrigger: (topic) =>
    topic ? `make a matching game on ${topic}` : "make a matching game",
  instruction: MATCHING_SYSTEM_INSTRUCTION,
  schema: matchingSchema,
  summarize: (m) => `Matching: ${m.matching_title}`,
  fallbackMessage:
    "Sorry, I couldn't put a matching game together just now. Please try asking me again.",
};
