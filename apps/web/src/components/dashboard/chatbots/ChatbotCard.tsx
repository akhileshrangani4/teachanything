"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bot, MoreVertical, Trash2, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { Chatbot } from "@/types/database";
import { MODELS, formatDate } from "./chatbot-constants";

interface ChatbotCardProps {
  chatbot: Chatbot;
  onDelete: (chatbotId: string) => void;
}

export function ChatbotCard({ chatbot, onDelete }: ChatbotCardProps) {
  return (
    <Card className="border border-border/60 bg-card card-hover-lift shadow-xs group">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <Link
            href={`/chatbot/${chatbot.id}`}
            className="flex-1 space-y-3 hover:opacity-80 transition-opacity"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors flex-shrink-0">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xl font-semibold text-foreground truncate">
                  {chatbot.name}
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {MODELS.find((m) => m.value === chatbot.model)?.label ||
                    chatbot.model}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap pl-0 sm:pl-[52px]">
              <span className="font-mono bg-muted px-2 py-1 rounded">
                {chatbot.id.slice(0, 8)}...
              </span>
              <span>•</span>
              <span>{formatDate(chatbot.createdAt)}</span>
            </div>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 hover:bg-muted flex-shrink-0"
                onClick={(e) => e.preventDefault()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <Link
                  href={`/chatbot/${chatbot.id}`}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open Chatbot
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  onDelete(chatbot.id);
                }}
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
