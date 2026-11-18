"use client";

import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CodeBlock,
  CodeBlockCode,
  CodeBlockGroup,
} from "@/components/ui/code-block";
import { CopyButton } from "@/components/ui/copy-button";
import {
  generateWidgetHTML,
  generateWidgetReact,
  generateWindowHTML,
} from "@/components/embed/embed-code-generators";
import { useTranslation, Trans } from "react-i18next";

interface EmbedCodeProps {
  shareToken: string;
}

export function EmbedCode({ shareToken }: EmbedCodeProps) {
  const { t } = useTranslation();
  // Use environment variable for production, fallback to window.location.origin for dev
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");
  const widgetHTML = generateWidgetHTML(baseUrl, shareToken);
  const widgetReact = generateWidgetReact(baseUrl, shareToken);
  const windowHTML = generateWindowHTML(baseUrl, shareToken);

  return (
    <Tabs defaultValue="widget" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="widget" className="text-xs sm:text-sm">
          {t("chatbotDetail.embed.widgetTab")}
        </TabsTrigger>
        <TabsTrigger value="window" className="text-xs sm:text-sm">
          {t("chatbotDetail.embed.windowTab")}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="widget" className="space-y-4 mt-6">
        <div className="mb-4 p-4 bg-muted rounded-lg text-sm">
          <p className="font-medium mb-2">
            {t("chatbotDetail.embed.widgetModeTitle")}
          </p>
          <p className="text-muted-foreground">
            {t("chatbotDetail.embed.widgetModeDescription")}
          </p>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {t("chatbotDetail.embed.htmlLabel")}
            </Label>
            <p className="text-xs text-muted-foreground mb-2">
              <Trans
                i18nKey="chatbotDetail.embed.htmlWidgetHelp"
                values={{ tag: "</body>" }}
                components={{
                  code: <code className="bg-muted px-1 py-0.5 rounded" />,
                }}
              />
            </p>
            <CodeBlock>
              <CodeBlockGroup>
                <span className="px-4 py-2 text-xs text-muted-foreground">
                  html
                </span>
                <CopyButton text={widgetHTML} />
              </CodeBlockGroup>
              <CodeBlockCode code={widgetHTML} language="html" />
            </CodeBlock>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {t("chatbotDetail.embed.reactLabel")}
            </Label>
            <p className="text-xs text-muted-foreground mb-2">
              {t("chatbotDetail.embed.reactHelp")}
            </p>
            <CodeBlock>
              <CodeBlockGroup>
                <span className="px-4 py-2 text-xs text-muted-foreground">
                  javascript
                </span>
                <CopyButton text={widgetReact} />
              </CodeBlockGroup>
              <CodeBlockCode code={widgetReact} language="javascript" />
            </CodeBlock>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="window" className="space-y-4 mt-6">
        <div className="mb-4 p-4 bg-muted rounded-lg text-sm">
          <p className="font-medium mb-2">
            {t("chatbotDetail.embed.windowModeTitle")}
          </p>
          <p className="text-muted-foreground">
            {t("chatbotDetail.embed.windowModeDescription")}
          </p>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            {t("chatbotDetail.embed.windowHtmlLabel")}
          </Label>
          <p className="text-xs text-muted-foreground mb-2">
            {t("chatbotDetail.embed.windowHelp")}
          </p>
          <CodeBlock>
            <CodeBlockGroup>
              <span className="px-4 py-2 text-xs text-muted-foreground">
                html
              </span>
              <CopyButton text={windowHTML} />
            </CodeBlockGroup>
            <CodeBlockCode code={windowHTML} language="html" />
          </CodeBlock>
        </div>
      </TabsContent>
    </Tabs>
  );
}
