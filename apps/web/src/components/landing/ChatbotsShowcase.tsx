"use client";

import { motion } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { Calendar, User, FileText, ArrowRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

const backgroundImages = [
  "/assets/featured chatbots bg/1.jpg",
  "/assets/featured chatbots bg/2.jpg",
  "/assets/featured chatbots bg/3.jpg",
  "/assets/featured chatbots bg/4.jpg",
] as const;

export default function ChatbotsShowcase() {
  const { data: featuredChatbots, isLoading } =
    trpc.chatbot.getFeatured.useQuery();

  // Hide section if no featured chatbots
  if (!isLoading && (!featuredChatbots || featuredChatbots.length === 0)) {
    return null;
  }

  const chatbotCount = featuredChatbots?.length || 0;
  const isSingle = chatbotCount === 1;

  return (
    <section className="py-20 px-6 md:px-12 bg-white">
      <div className="max-w-7xl mx-auto">
        {isLoading ? (
          // Loading State
          isSingle ? (
            <div className="grid md:grid-cols-2 gap-20 items-center">
              <div className="aspect-[4/3] bg-muted rounded-2xl animate-pulse" />
              <div className="space-y-4">
                <div className="h-12 bg-muted rounded animate-pulse" />
                <div className="h-6 bg-muted rounded animate-pulse w-3/4" />
              </div>
            </div>
          ) : (
            <>
              <div className="mb-12">
                <div className="h-12 bg-muted rounded animate-pulse mb-4 w-1/3" />
                <div className="h-6 bg-muted rounded animate-pulse w-1/2" />
              </div>
              <div
                className={`grid gap-6 ${
                  chatbotCount === 2
                    ? "grid-cols-1 md:grid-cols-2"
                    : chatbotCount === 3
                      ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
                      : "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
                }`}
              >
                {[1, 2, 3, 4].slice(0, chatbotCount || 4).map((i) => (
                  <div
                    key={i}
                    className="aspect-[4/3] bg-muted rounded-2xl animate-pulse"
                  />
                ))}
              </div>
            </>
          )
        ) : featuredChatbots && featuredChatbots.length > 0 ? (
          isSingle ? (
            // Single chatbot: Inverted two-column layout
            <div className="grid md:grid-cols-2 gap-20 items-center">
              {/* Left: Chatbot Card */}
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.7 }}
              >
                {(() => {
                  const chatbot = featuredChatbots[0];
                  if (!chatbot) return null;

                  const hasShareToken = chatbot.shareToken;
                  const index = 0;

                  const CardContent = (
                    <div
                      className={`group relative aspect-[4/3] rounded-2xl overflow-hidden ${
                        hasShareToken
                          ? "cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                          : ""
                      } transition-all duration-300 shadow-md hover:shadow-xl`}
                    >
                      {/* Background image */}
                      <Image
                        src={
                          backgroundImages[index % backgroundImages.length] ||
                          backgroundImages[0]
                        }
                        alt=""
                        fill
                        className="object-cover opacity-70"
                      />

                      {/* Subtle overlay for cohesion */}
                      <div className="absolute inset-0 bg-gradient-to-br from-slate-900/40 via-slate-800/30 to-slate-900/40" />

                      {/* Bottom gradient for text readability */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-black/20" />

                      {/* Inset shadow from all sides */}
                      <div className="absolute inset-0 shadow-[inset_0_0_60px_rgba(0,0,0,0.4)]" />

                      {/* Content */}
                      <div className="relative h-full p-6 md:p-8 flex flex-col justify-between z-10">
                        {/* Top Section */}
                        <div className="flex items-start justify-between mb-auto">
                          <div className="flex-1 pr-4">
                            <h3 className="text-xl md:text-2xl font-bold text-white mb-1.5 group-hover:text-white/95 transition-colors">
                              {chatbot.name}
                            </h3>
                            {chatbot.description && (
                              <p className="text-sm text-white/95 font-normal">
                                {chatbot.description}
                              </p>
                            )}
                          </div>
                          {hasShareToken && (
                            <div className="flex-shrink-0">
                              <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center group-hover:bg-white/30 group-hover:scale-110 transition-all duration-300">
                                <ArrowRight className="h-5 w-5 text-white" />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Bottom Metadata Section */}
                        <div className="mt-auto pt-4 border-t border-white/20">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-white/95">
                            <div className="flex items-center gap-1.5">
                              <User className="h-4 w-4" />
                              <span className="font-medium">
                                {chatbot.customAuthorName ||
                                  chatbot.userName ||
                                  "Unknown"}
                              </span>
                            </div>
                            <span className="text-white/60">•</span>
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-4 w-4" />
                              <span>
                                {new Date(chatbot.createdAt).toLocaleDateString(
                                  "en-US",
                                  {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  },
                                )}
                              </span>
                            </div>
                            <span className="text-white/60">•</span>
                            <div className="flex items-center gap-1.5">
                              <FileText className="h-4 w-4" />
                              <span>
                                {chatbot.fileCount} file
                                {chatbot.fileCount !== 1 ? "s" : ""}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );

                  return hasShareToken ? (
                    <Link
                      href={`/chat/${chatbot.shareToken}`}
                      className="block"
                    >
                      {CardContent}
                    </Link>
                  ) : (
                    CardContent
                  );
                })()}
              </motion.div>

              {/* Right: Header Text */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.7 }}
              >
                <h2 className="text-4xl md:text-5xl font-serif font-light text-foreground mb-6 leading-tight">
                  Featured Chatbots
                </h2>
                <p className="text-muted-foreground text-lg leading-relaxed">
                  Explore chatbots created by our community of educators and
                  researchers. Each chatbot is carefully crafted to provide
                  accurate, context-aware responses based on uploaded materials.
                </p>
              </motion.div>
            </div>
          ) : (
            // Multiple chatbots: Header on top, cards below
            <>
              {/* Header */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.7 }}
                className="mb-12"
              >
                <h2 className="text-4xl md:text-5xl font-serif font-light text-foreground mb-4">
                  Featured Chatbots
                </h2>
                <p className="text-muted-foreground text-lg">
                  Explore chatbots created by our community
                </p>
              </motion.div>

              {/* Cards Grid */}
              <div
                className={`grid gap-6 ${
                  chatbotCount === 2
                    ? "grid-cols-1 md:grid-cols-2"
                    : chatbotCount === 3
                      ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
                      : "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
                }`}
              >
                {featuredChatbots.map((chatbot, index) => {
                  const hasShareToken = chatbot.shareToken;

                  const CardContent = (
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
                      {/* Background image */}
                      <Image
                        src={
                          backgroundImages[index % backgroundImages.length] ||
                          backgroundImages[0]
                        }
                        alt=""
                        fill
                        className="object-cover opacity-70"
                      />

                      {/* Subtle overlay for cohesion */}
                      <div className="absolute inset-0 bg-gradient-to-br from-slate-900/40 via-slate-800/30 to-slate-900/40" />

                      {/* Bottom gradient for text readability */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-black/20" />

                      {/* Inset shadow from all sides */}
                      <div className="absolute inset-0 shadow-[inset_0_0_60px_rgba(0,0,0,0.4)]" />

                      {/* Content */}
                      <div className="relative h-full p-6 flex flex-col justify-between z-10">
                        {/* Top Section */}
                        <div className="flex items-start justify-between mb-auto">
                          <div className="flex-1 pr-3">
                            <h3 className="text-lg font-bold text-white mb-1.5 group-hover:text-white/95 transition-colors line-clamp-2">
                              {chatbot.name}
                            </h3>
                            {chatbot.description && (
                              <p className="text-xs text-white/95 font-normal line-clamp-2">
                                {chatbot.description}
                              </p>
                            )}
                          </div>
                          {hasShareToken && (
                            <div className="flex-shrink-0">
                              <div className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center group-hover:bg-white/30 group-hover:scale-110 transition-all duration-300">
                                <ArrowRight className="h-4 w-4 text-white" />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Bottom Metadata Section */}
                        <div className="mt-auto pt-3 border-t border-white/20">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-white/95">
                            <div className="flex items-center gap-1.5">
                              <User className="h-3.5 w-3.5" />
                              <span className="font-medium">
                                {chatbot.customAuthorName ||
                                  chatbot.userName ||
                                  "Unknown"}
                              </span>
                            </div>
                            <span className="text-white/60">•</span>
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5" />
                              <span>
                                {new Date(chatbot.createdAt).toLocaleDateString(
                                  "en-US",
                                  {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  },
                                )}
                              </span>
                            </div>
                            <span className="text-white/60">•</span>
                            <div className="flex items-center gap-1.5">
                              <FileText className="h-3.5 w-3.5" />
                              <span>
                                {chatbot.fileCount} file
                                {chatbot.fileCount !== 1 ? "s" : ""}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );

                  return hasShareToken ? (
                    <Link
                      key={chatbot.id}
                      href={`/chat/${chatbot.shareToken}`}
                      className="block"
                    >
                      {CardContent}
                    </Link>
                  ) : (
                    <div key={chatbot.id}>{CardContent}</div>
                  );
                })}
              </div>
            </>
          )
        ) : null}
      </div>
    </section>
  );
}
