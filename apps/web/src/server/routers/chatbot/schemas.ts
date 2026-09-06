import { z } from "zod";
import { SUPPORTED_MODELS, DEPRECATED_MODELS } from "@teachanything/ai";

// Accept both current and deprecated model IDs for backwards compatibility (D-08).
// Chatbots stored with old IDs are resolved at query time via resolveModel().
const allAcceptedModels = [...SUPPORTED_MODELS, ...DEPRECATED_MODELS] as [
  string,
  ...string[],
];

export const createChatbotSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(200).optional(),
  systemPrompt: z.string().min(1).max(1000000),
  model: z.enum(allAcceptedModels),
  temperature: z.number().min(0).max(100).default(70),
  maxTokens: z.number().min(100).max(4000).default(2000),
  welcomeMessage: z.string().max(500).optional(),
  suggestedQuestions: z.array(z.string()).max(5).default([]),
  showSources: z.boolean().optional(),
});
