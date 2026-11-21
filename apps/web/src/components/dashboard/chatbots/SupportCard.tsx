"use client";

import { useTranslation } from "react-i18next";
import { Heart, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { contactHref, getDonationUrl } from "@/lib/support-links";

/**
 * A quiet note at the foot of the chatbots list: Teach Anything is a free,
 * non-profit service, with a donate link and a contact link for professors
 * whose department or school might sponsor it. `contactEmail` is resolved on
 * the server.
 */
export function SupportCard({ contactEmail }: { contactEmail: string }) {
  const { t } = useTranslation();

  return (
    <Card className="border border-border/60 bg-muted/30 shadow-none">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold text-foreground">
            {t("chatbots.support.title")}
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {t("chatbots.support.description")}
          </p>
        </div>
        <div className="flex flex-shrink-0 gap-2">
          <Button asChild size="sm" variant="outline">
            <a
              href={getDonationUrl()}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Heart className="h-4 w-4" />
              {t("chatbots.support.donate")}
            </a>
          </Button>
          <Button asChild size="sm" variant="outline">
            <a href={contactHref(contactEmail)}>
              <Mail className="h-4 w-4" />
              {t("chatbots.support.contact")}
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
