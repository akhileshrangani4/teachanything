/**
 * Mind Map Mode: a hierarchical concept map. The model returns a recursive tree
 * (one `root` concept with nested `children`); the client renders it as an
 * interactive collapsible outline. Shares the structured-mode pipeline (detect ->
 * strict-JSON instruction -> buffer -> validate -> structured event) with Quiz,
 * Flashcard, and Test mode.
 */
import { z } from "zod";

export interface MindMapNode {
  label: string;
  children?: MindMapNode[];
}

export const mindMapNodeSchema: z.ZodType<MindMapNode> = z.lazy(() =>
  z.object({
    label: z.string().min(1),
    children: z.array(mindMapNodeSchema).max(8).optional(),
  }),
);

export const mindMapSchema = z.object({
  title: z.string().min(1),
  root: mindMapNodeSchema,
});

export type MindMap = z.infer<typeof mindMapSchema>;

/**
 * Phrases that switch the chatbot into Mind Map Mode. Matched against the
 * lowercased, trimmed message. Anchored to the start of the message to avoid
 * mid-sentence false positives ("what is a mind map", "I love mind maps").
 */
const MINDMAP_TRIGGER_PATTERNS: RegExp[] = [
  // verb-led: "make a mind map", "create a mind map on X", "show mind map for X", "draw a concept map"
  /^(?:can you |could you |please )?(?:make|create|build|generate|draw|show|give me) (?:me )?(?:a |an |the )?(?:mind|concept) ?map\b/,
  // "mind map photosynthesis", "concept map of X" -- mind/concept map followed by a topic
  /^(?:mind|concept) ?map\b/,
];

/**
 * Detect whether the user is asking for a mind map.
 */
export function isMindMapRequest(message: string): boolean {
  const normalized = message.toLowerCase().trim();
  return MINDMAP_TRIGGER_PATTERNS.some((p) => p.test(normalized));
}

/**
 * Appended to the system prompt when a mind map is requested. Instructs the
 * model to reply with ONLY minified JSON matching `mindMapSchema` -- no prose,
 * markdown, or code fences -- so the backend can parse it deterministically.
 */
export const MINDMAP_SYSTEM_INSTRUCTION = `

MIND MAP MODE: The student has asked for a mind map. Generate a hierarchical concept map based on the course material and context above. Reply with ONLY a single minified JSON object and nothing else -- no prose, no markdown, no code fences, no explanation before or after.

The JSON must match exactly this shape:
{"title":"<short title>","root":{"label":"<central concept>","children":[{"label":"<subtopic>","children":[{"label":"<detail>"}]}]}}

Rules:
- One central "root" concept; nest related ideas as "children" to a sensible depth (2 to 4 levels).
- Keep each "label" short (a few words), not full sentences.
- Aim for 3 to 6 top-level branches; do not exceed 8 children on any node.
- Base the map on the provided course material when available; otherwise use general knowledge of the topic.
- Output valid JSON only.`;
