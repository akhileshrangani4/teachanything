"use client";

import { MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { EmbedLoading } from "@/components/embed/EmbedLoading";

export default function EmbedButtonPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data === "openChat") {
        setIsChatOpen(true);
      } else if (event.data === "closeChat") {
        setIsChatOpen(false);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleClick = () => {
    if (window.parent) {
      const message = isChatOpen ? "closeChat" : "openChat";
      window.parent.postMessage(message, "*");
      setIsChatOpen(!isChatOpen);
    }
  };

  if (!isMounted) {
    return <EmbedLoading />;
  }

  return (
    <div className="w-full h-full flex items-center justify-center bg-transparent p-0 m-0 overflow-hidden">
      <button
        onClick={handleClick}
        className="w-full h-full aspect-square flex items-center justify-center rounded-full hover:opacity-80 transition-opacity shadow-md border-2 border-border bg-transparent p-0 m-0 min-w-0 min-h-0"
        aria-label={isChatOpen ? "Close chat" : "Open chat"}
      >
        <MessageSquare className="w-6 h-6 flex-shrink-0" />
      </button>
    </div>
  );
}
