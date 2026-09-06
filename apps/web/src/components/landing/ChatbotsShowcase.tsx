"use client";

import { motion } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { ShowcaseCard } from "./chatbots-showcase/showcase-card";
import { ShowcaseLoading } from "./chatbots-showcase/showcase-loading";
import { getGridClassName } from "./chatbots-showcase/constants";

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
          <ShowcaseLoading isSingle={isSingle} chatbotCount={chatbotCount} />
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
                {featuredChatbots[0] && (
                  <ShowcaseCard
                    chatbot={featuredChatbots[0]}
                    index={0}
                    variant="single"
                  />
                )}
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
              <div className={getGridClassName(chatbotCount)}>
                {featuredChatbots.map((chatbot, index) => (
                  <ShowcaseCard
                    key={chatbot.id}
                    chatbot={chatbot}
                    index={index}
                    variant="grid"
                  />
                ))}
              </div>
            </>
          )
        ) : null}
      </div>
    </section>
  );
}
