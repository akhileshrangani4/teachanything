"use client";

import { motion } from "framer-motion";
import { BACKGROUND_IMAGE } from "./hero/constants";
import { buildGradient } from "./hero/utils";
import HeroHeading from "./hero/HeroHeading";
import HeroSubheading from "./hero/HeroSubheading";
import HeroCTA from "./hero/HeroCTA";

export default function HeroSection() {
  return (
    <section
      className="min-h-screen flex flex-col items-center justify-center px-6 md:px-12 relative overflow-hidden"
      style={{
        backgroundImage: `${buildGradient()}, url('${BACKGROUND_IMAGE}')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "scroll",
      }}
    >
      <div className="max-w-7xl mx-auto w-full relative z-10 min-h-screen flex flex-col">
        {/* Centered Hero Content */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex flex-col items-center justify-center text-center flex-1"
        >
          <HeroHeading />
          <HeroSubheading text="Build open-access, course-specific AI chatbots using open-source LLMs for your students. Upload materials and customize responses—all for free." />
          <HeroCTA />
        </motion.div>
      </div>
    </section>
  );
}
