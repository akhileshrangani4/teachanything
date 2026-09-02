"use client";

import { motion } from "framer-motion";
import { Calendar, User, FileText, ArrowRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import type { RouterOutputs } from "@/lib/trpc";
import { backgroundImages } from "./constants";

export type FeaturedChatbot = RouterOutputs["chatbot"]["getFeatured"][number];

// Card visual variants: the hero-sized single card vs the smaller grid card.
type ShowcaseVariant = "single" | "grid";

// One featured chatbot card; wraps in a link when a share token exists.
export function ShowcaseCard({
  chatbot,
  index,
  variant,
}: {
  chatbot: FeaturedChatbot;
  index: number;
  variant: ShowcaseVariant;
}) {
  const hasShareToken = chatbot.shareToken;
  const isSingle = variant === "single";

  const cardInner = (
    <>
      {/* Background image */}
      <Image
        src={
          backgroundImages[index % backgroundImages.length] ||
          backgroundImages[0]
        }
        alt=""
        fill
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        className="object-cover opacity-70"
      />

      {/* Subtle overlay for cohesion */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900/40 via-slate-800/30 to-slate-900/40" />

      {/* Bottom gradient for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-black/20" />

      {/* Inset shadow from all sides */}
      <div className="absolute inset-0 shadow-[inset_0_0_60px_rgba(0,0,0,0.4)]" />

      {/* Content */}
      <div
        className={`relative h-full ${
          isSingle ? "p-6 md:p-8" : "p-6"
        } flex flex-col justify-between z-10`}
      >
        {/* Top Section */}
        <div className="flex items-start justify-between mb-auto">
          <div className={isSingle ? "flex-1 pr-4" : "flex-1 pr-3"}>
            <h3
              className={`${
                isSingle ? "text-xl md:text-2xl" : "text-lg"
              } font-bold text-white mb-1.5 group-hover:text-white/95 transition-colors${
                isSingle ? "" : " line-clamp-2"
              }`}
            >
              {chatbot.name}
            </h3>
            {chatbot.description && (
              <p
                className={`${
                  isSingle ? "text-sm" : "text-xs"
                } text-white/95 font-normal${isSingle ? "" : " line-clamp-2"}`}
              >
                {chatbot.description}
              </p>
            )}
          </div>
          {hasShareToken && (
            <div className="flex-shrink-0">
              <div
                className={`${
                  isSingle ? "w-10 h-10" : "w-9 h-9"
                } rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center group-hover:bg-white/30 group-hover:scale-110 transition-all duration-300`}
              >
                <ArrowRight
                  className={`${isSingle ? "h-5 w-5" : "h-4 w-4"} text-white`}
                />
              </div>
            </div>
          )}
        </div>

        {/* Bottom Metadata Section */}
        <div
          className={`mt-auto ${
            isSingle ? "pt-4" : "pt-3"
          } border-t border-white/20`}
        >
          <div
            className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 ${
              isSingle ? "text-sm" : "text-xs"
            } text-white/95`}
          >
            <div className="flex items-center gap-1.5">
              <User className={`${isSingle ? "h-4 w-4" : "h-3.5 w-3.5"}`} />
              <span className="font-medium">
                {chatbot.customAuthorName || chatbot.userName || "Unknown"}
              </span>
            </div>
            <span className="text-white/60">•</span>
            <div className="flex items-center gap-1.5">
              <Calendar className={`${isSingle ? "h-4 w-4" : "h-3.5 w-3.5"}`} />
              <span>
                {new Date(chatbot.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
            <span className="text-white/60">•</span>
            <div className="flex items-center gap-1.5">
              <FileText className={`${isSingle ? "h-4 w-4" : "h-3.5 w-3.5"}`} />
              <span>
                {chatbot.fileCount} file
                {chatbot.fileCount !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  if (isSingle) {
    // Single chatbot: plain div wrapper with hero hover styles.
    const singleCard = (
      <div
        className={`group relative aspect-[4/3] rounded-2xl overflow-hidden ${
          hasShareToken
            ? "cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            : ""
        } transition-all duration-300 shadow-md hover:shadow-xl`}
      >
        {cardInner}
      </div>
    );

    return hasShareToken ? (
      <Link href={`/chat/${chatbot.shareToken}`} className="block">
        {singleCard}
      </Link>
    ) : (
      singleCard
    );
  }

  // Grid chatbots: animated card entrance.
  const gridCard = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className={`group relative aspect-[4/3] rounded-2xl overflow-hidden ${
        hasShareToken
          ? "cursor-pointer hover:scale-[1.02] hover:-translate-y-1 active:scale-[0.98]"
          : ""
      } transition-all duration-300 shadow-md hover:shadow-xl`}
    >
      {cardInner}
    </motion.div>
  );

  return hasShareToken ? (
    <Link
      key={chatbot.id}
      href={`/chat/${chatbot.shareToken}`}
      className="block"
    >
      {gridCard}
    </Link>
  ) : (
    <div key={chatbot.id}>{gridCard}</div>
  );
}
