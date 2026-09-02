"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/** Shown when the chatbot id doesn't resolve. */
export function ChatbotNotFound({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8 min-w-0">
      <div className="max-w-7xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Chatbot Not Found</CardTitle>
            <CardDescription>
              The chatbot you&apos;re looking for doesn&apos;t exist.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={onBack}>Back to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
