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
} from "@/components/embed/embedCodeGenerators";

interface EmbedCodeProps {
  shareToken: string;
}

export function EmbedCode({ shareToken }: EmbedCodeProps) {
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
          Widget (Floating Button)
        </TabsTrigger>
        <TabsTrigger value="window" className="text-xs sm:text-sm">
          Window (Always Visible)
        </TabsTrigger>
      </TabsList>

      <TabsContent value="widget" className="space-y-4 mt-6">
        <div className="mb-4 p-4 bg-muted rounded-lg text-sm">
          <p className="font-medium mb-2">Widget Mode (Recommended)</p>
          <p className="text-muted-foreground">
            Adds a floating chat button in the bottom-right corner of your
            website. When clicked, it opens a chat window. Users can close it
            when done. Perfect for most websites as it doesn&apos;t take up
            permanent space.
          </p>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              HTML (for standard websites, WordPress, etc.)
            </Label>
            <p className="text-xs text-muted-foreground mb-2">
              Paste this code before the closing{" "}
              <code className="bg-muted px-1 py-0.5 rounded">
                &lt;/body&gt;
              </code>{" "}
              tag in your HTML.
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
              React/Next.js Component
            </Label>
            <p className="text-xs text-muted-foreground mb-2">
              Use this if you&apos;re building with React or Next.js. Add it to
              your layout or main component.
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
          <p className="font-medium mb-2">Window Mode (Always Visible)</p>
          <p className="text-muted-foreground">
            Embeds the chat window directly on your page as an always-visible
            iframe. Good for dedicated support or chat pages, but takes up
            permanent screen space. The chat window cannot be closed by users.
          </p>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">HTML</Label>
          <p className="text-xs text-muted-foreground mb-2">
            Paste this code where you want the chat window to appear on your
            page.
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
