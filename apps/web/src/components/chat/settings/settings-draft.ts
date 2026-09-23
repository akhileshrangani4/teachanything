import { resolveModel } from "@teachanything/ai/models";

export interface ChatbotSettingsChatbot {
  name: string;
  description: string | null;
  model: string;
  systemPrompt: string;
  temperature: number | null;
  maxTokens: number | null;
  shareToken: string | null;
  sharingEnabled: boolean;
  showSources?: boolean;
}

export type SettingsDraft = {
  name: string;
  description: string;
  model: string;
  systemPrompt: string;
  temperature: string;
  maxTokens: string;
  showSources: boolean;
};

export function settingsFromChatbot(c: ChatbotSettingsChatbot): SettingsDraft {
  return {
    name: c.name,
    description: c.description ?? "",
    // A retired model id (e.g. Mistral Large 3) already runs on its
    // replacement via resolveModel at chat time. Show that same model here so
    // the form matches what the bot actually does, and so the next save
    // writes the live id back.
    model: resolveModel(c.model),
    systemPrompt: c.systemPrompt,
    temperature: c.temperature?.toString() ?? "70",
    maxTokens: c.maxTokens?.toString() ?? "2000",
    showSources: c.showSources ?? false,
  };
}
