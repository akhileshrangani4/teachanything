"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface HeroCTAProps {
  delay?: number;
}

export default function HeroCTA({ delay = 0.6 }: HeroCTAProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay }}
      className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8"
    >
      <Button
        asChild
        size="lg"
        className="bg-black text-white hover:bg-black/90 rounded-lg px-8 py-6 text-base font-medium shadow-md hover:shadow-lg transition-all duration-300"
      >
        <Link href="/register">Get Started Free</Link>
      </Button>
      <Button
        asChild
        variant="outline"
        size="lg"
        className="bg-white border-2 border-black text-black hover:bg-white/90 rounded-lg px-8 py-6 text-base hover:text-black font-medium transition-all duration-300"
      >
        <Link href="#how-it-works">How It Works</Link>
      </Button>
    </motion.div>
  );
}
