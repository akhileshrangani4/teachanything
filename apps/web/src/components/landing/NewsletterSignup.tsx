"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Mail } from "lucide-react";

export default function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const subscribe = trpc.newsletter.subscribe.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      setEmail("");
      setErrorMsg("");
    },
    onError: () => {
      setErrorMsg("Failed to subscribe. Please try again.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }
    subscribe.mutate({ email: trimmed });
  };

  return (
    <section className="py-20 px-6 md:px-12 bg-muted/30 border-t border-border">
      <div className="max-w-2xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex justify-center mb-4">
            <span className="inline-flex items-center justify-center rounded-full bg-primary/10 p-3">
              <Mail className="h-6 w-6 text-primary" />
            </span>
          </div>

          <h2 className="text-3xl md:text-4xl font-serif font-light text-foreground mb-3 leading-tight">
            Stay in the loop
          </h2>
          <p className="text-muted-foreground text-base mb-8 leading-[1.8]">
            Get updates on new features, research, and best practices for
            AI-powered teaching — straight to your inbox.
          </p>

          {submitted ? (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-green-600 font-medium"
            >
              You&apos;re subscribed! Thank you for joining.
            </motion.p>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="flex flex-col sm:flex-row gap-3 justify-center items-start max-w-md mx-auto"
            >
              <div className="flex-1 w-full">
                <Input
                  type="email"
                  placeholder="your@email.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={subscribe.isPending}
                  className="w-full"
                  aria-label="Email address"
                />
                {errorMsg && (
                  <p className="mt-1.5 text-sm text-destructive text-left">
                    {errorMsg}
                  </p>
                )}
              </div>
              <Button
                type="submit"
                disabled={subscribe.isPending}
                className="shrink-0 w-full sm:w-auto"
              >
                {subscribe.isPending ? "Subscribing..." : "Subscribe"}
              </Button>
            </form>
          )}

          <p className="text-xs text-muted-foreground mt-4">
            No spam. Unsubscribe any time.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
