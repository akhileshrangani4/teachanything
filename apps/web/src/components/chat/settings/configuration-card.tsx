"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormFieldWithCounter } from "@/components/ui/form-field-with-counter";
import { WrappableText } from "@/components/ui/wrappable-text";
import { CharacterCounter } from "@/components/ui/character-counter";
import { MODEL_REGISTRY } from "@teachanything/ai/models";
import { contextWindowLabel } from "./context-window-label";
import { VALIDATION_LIMITS } from "@/lib/validation";
import type { SettingsDraft } from "./settings-draft";
import { modelsByProvider } from "./models-by-provider";
import { WelcomeMessageField } from "./welcome-message-field";
import { useTranslation } from "react-i18next";

interface ConfigurationCardProps {
  draft: SettingsDraft;
  setField: <K extends keyof SettingsDraft>(
    key: K,
    value: SettingsDraft[K],
  ) => void;
  isEditing: boolean;
  onEditStart: () => void;
  onCancel: () => void;
  onSave: () => void;
  isSaving: boolean;
  /** A legacy chatbot may be saved on a model that no longer supports document
   * tools; when that happens we still render it as a selectable option so the
   * form stays valid and editing does not silently change the saved model. */
  savedModelIsNonTool: boolean;
}

export function ConfigurationCard({
  draft,
  setField,
  isEditing,
  onEditStart,
  onCancel,
  onSave,
  isSaving,
  savedModelIsNonTool,
}: ConfigurationCardProps) {
  const { t } = useTranslation();
  const { name, description, model, systemPrompt, temperature, maxTokens } =
    draft;

  return (
    <div className="space-y-6 p-6 bg-muted/30 rounded-lg border">
      {/* Header with Edit Button */}
      <div className="flex items-center justify-between pb-4 border-b">
        <div>
          <h3 className="text-lg font-semibold">
            {t("chatbotSettings.configuration.title")}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t("chatbotSettings.configuration.description")}
          </p>
        </div>
        {/* Edit/Save/Cancel buttons */}
        <div className="flex gap-2">
          {!isEditing ? (
            <Button onClick={onEditStart} variant="outline" size="sm">
              {t("chatbotSettings.configuration.edit")}
            </Button>
          ) : (
            <>
              <Button
                onClick={onCancel}
                variant="outline"
                size="sm"
                disabled={isSaving}
              >
                {t("common.actions.cancel")}
              </Button>
              <Button onClick={onSave} size="sm" disabled={isSaving}>
                {isSaving
                  ? t("common.actions.saving")
                  : t("common.actions.saveChanges")}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Name */}
      {isEditing ? (
        <FormFieldWithCounter
          id="name"
          label={t("chatbots.fields.name")}
          value={name}
          onChange={(value) => setField("name", value)}
          maxLength={VALIDATION_LIMITS.NAME_MAX_LENGTH}
          warningThreshold={VALIDATION_LIMITS.NAME_WARNING_THRESHOLD}
          helperText={t("chatbotSettings.configuration.nameHelp")}
          placeholder={t("chatbotSettings.configuration.namePlaceholder")}
          showCounter={isEditing}
        />
      ) : (
        <div className="space-y-2">
          <Label className="text-base font-semibold">
            {t("chatbots.fields.name")}
          </Label>
          <p className="text-xs text-muted-foreground mb-2">
            {t("chatbotSettings.configuration.nameHelp")}
          </p>
          <div className="px-3 py-2 bg-background rounded-md border">
            <p className="text-sm">{name}</p>
          </div>
        </div>
      )}

      {/* Description */}
      {isEditing ? (
        <FormFieldWithCounter
          id="description"
          label={t("chatbots.fields.description")}
          value={description}
          onChange={(value) => setField("description", value)}
          maxLength={VALIDATION_LIMITS.DESCRIPTION_MAX_LENGTH}
          warningThreshold={VALIDATION_LIMITS.DESCRIPTION_WARNING_THRESHOLD}
          helperText={t("chatbotSettings.configuration.descriptionHelp")}
          placeholder={t(
            "chatbotSettings.configuration.descriptionPlaceholder",
          )}
          type="textarea"
          rows={3}
        />
      ) : (
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <Label className="text-base font-semibold">
              {t("chatbots.fields.description")}
            </Label>
            <CharacterCounter
              current={description.length}
              max={VALIDATION_LIMITS.DESCRIPTION_MAX_LENGTH}
              warningThreshold={VALIDATION_LIMITS.DESCRIPTION_WARNING_THRESHOLD}
            />
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            {t("chatbotSettings.configuration.descriptionHelp")}
          </p>
          <div className="px-3 py-2 bg-background rounded-md border">
            <p className="text-sm">
              <WrappableText>
                {description ||
                  t("chatbotSettings.configuration.noDescription")}
              </WrappableText>
            </p>
          </div>
        </div>
      )}

      <WelcomeMessageField
        value={draft.welcomeMessage}
        onChange={(value) => setField("welcomeMessage", value)}
        isEditing={isEditing}
      />

      {/* Model */}
      <div className="space-y-2">
        <Label htmlFor="model" className="text-base font-semibold">
          {t("chatbots.fields.model")}
        </Label>
        <p className="text-xs text-muted-foreground mb-2">
          {t("chatbotSettings.configuration.modelHelp")}
        </p>
        {isEditing ? (
          <Select value={model} onValueChange={(v) => setField("model", v)}>
            <SelectTrigger id="model">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from(modelsByProvider.entries()).map(
                ([provider, models]) => (
                  <SelectGroup key={provider}>
                    <SelectLabel>{provider}</SelectLabel>
                    {models.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {t("chatbotSettings.configuration.modelOption", {
                          model: m.displayName,
                          contextWindow: contextWindowLabel(t, m.contextWindow),
                        })}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ),
              )}
              {/* Legacy chatbots may have a saved model that no longer
                  supports document tools. Keep it selectable so editing
                  other fields does not silently change the saved model. */}
              {savedModelIsNonTool && (
                <SelectItem value={model}>
                  {t("chatbotSettings.configuration.modelWithoutTools", {
                    model:
                      MODEL_REGISTRY[model as keyof typeof MODEL_REGISTRY]
                        ?.displayName ?? model,
                  })}
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        ) : (
          <div className="px-3 py-2 bg-background rounded-md border">
            <p className="text-sm">
              {MODEL_REGISTRY[model as keyof typeof MODEL_REGISTRY]
                ?.displayName ?? model}
            </p>
          </div>
        )}
      </div>

      {/* System Prompt */}
      <div className="space-y-2">
        <Label htmlFor="systemPrompt" className="text-base font-semibold">
          {t("chatbots.fields.systemPrompt")}
        </Label>
        <p className="text-xs text-muted-foreground mb-2">
          {t("chatbotSettings.configuration.systemPromptHelp")}
        </p>
        <Textarea
          id="systemPrompt"
          value={systemPrompt}
          onChange={(e) => setField("systemPrompt", e.target.value)}
          disabled={!isEditing}
          rows={6}
          className={
            !isEditing ? "bg-background resize-none" : "resize-y min-h-[150px]"
          }
        />
      </div>

      {/* Temperature and Max Tokens */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="temperature" className="text-base font-semibold">
            {t("chatbots.fields.temperature")}
          </Label>
          <p className="text-xs text-muted-foreground mb-2">
            {t("chatbots.fields.temperatureHelp")}
          </p>
          {isEditing ? (
            <Input
              id="temperature"
              type="number"
              min="0"
              max="100"
              step="1"
              value={temperature}
              onChange={(e) => setField("temperature", e.target.value)}
            />
          ) : (
            <div className="px-3 py-2 bg-background rounded-md border">
              <p className="text-sm">{temperature}</p>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="maxTokens" className="text-base font-semibold">
            {t("chatbots.fields.maxTokens")}
          </Label>
          <p className="text-xs text-muted-foreground mb-2">
            {t("chatbots.fields.maxTokensHelp", { min: 100, max: 4000 })}
          </p>
          {isEditing ? (
            <Input
              id="maxTokens"
              type="number"
              min="100"
              max="4000"
              step="100"
              value={maxTokens}
              onChange={(e) => setField("maxTokens", e.target.value)}
            />
          ) : (
            <div className="px-3 py-2 bg-background rounded-md border">
              <p className="text-sm">{maxTokens}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
