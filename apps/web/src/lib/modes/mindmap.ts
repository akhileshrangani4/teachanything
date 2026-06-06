import {
  isMindMapRequest,
  mindMapSchema,
  MINDMAP_SYSTEM_INSTRUCTION,
  type MindMap,
} from "@/lib/mindmap";
import type { StructuredMode } from "./types";

export const mindmapMode: StructuredMode<MindMap> = {
  id: "mindmap",
  label: "mind map",
  detect: isMindMapRequest,
  canonicalTrigger: (topic) =>
    topic ? `make a mind map of ${topic}` : "make a mind map",
  instruction: MINDMAP_SYSTEM_INSTRUCTION,
  schema: mindMapSchema,
  summarize: (m) => `Mind map: ${m.title}`,
  fallbackMessage:
    "Sorry, I couldn't put a mind map together just now. Please try asking me for a mind map again.",
};
