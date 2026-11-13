"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

/** Shown when the chatbot id doesn't resolve. */
export function ChatbotNotFound({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8 min-w-0">
      <div className="max-w-7xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>{t("chatbotDetail.notFound.title")}</CardTitle>
            <CardDescription>
              {t("chatbotDetail.notFound.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={onBack}>{t("chatbotDetail.notFound.back")}</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
