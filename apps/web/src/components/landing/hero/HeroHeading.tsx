"use client";

import { motion } from "framer-motion";
import { BrandName } from "@/components/brand/BrandName";

interface HeroHeadingProps {
  delay?: number;
}

export default function HeroHeading({ delay = 0.2 }: HeroHeadingProps) {
  return (
    <motion.h1
      className="text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold mb-8 leading-tight"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay }}
    >
      <BrandName
        serifAnything
        className="text-black"
        anythingClassName="text-[#157F3C]"
        markClassName="ml-4 text-[0.24em] text-black"
      />
    </motion.h1>
  );
}
