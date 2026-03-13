"use client";

import { motion } from "framer-motion";
import Image from "next/image";

export default function InfoSection() {
  return (
    <section id="info" className="py-20 px-6 md:px-12 bg-white">
      <div className="max-w-7xl mx-auto">
        <motion.div
          className="mb-12 text-center"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-5xl font-serif font-light text-foreground mb-4">
            Empowering Professors with Open-Access AI
          </h2>
          <p className="text-sm text-muted-foreground">
            Built by{" "}
            <a
              href={
                process.env.NEXT_PUBLIC_LINKEDIN_URL ||
                "https://www.linkedin.com/in/akhileshrangani/"
              }
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline font-medium"
            >
              Akhilesh Rangani
            </a>{" "}
            under the guidance of Professor Alexa Alice Joubin at Digital
            Humanities Institute at George Washington University.
          </p>
        </motion.div>

        {/* Large Image */}
        <motion.div
          className="aspect-[21/9] rounded-2xl overflow-hidden shadow-lg relative"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7 }}
        >
          <Image
            src="/qs-ai.png"
            alt="Professor Alexa Alice Joubin at the QS Higher Ed Summit in Washington, D.C., June 4, 2024"
            width={1920}
            height={823}
            className="w-full h-full object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-white via-white/50 to-transparent pointer-events-none" />
        </motion.div>
        <p className="text-sm text-muted-foreground text-center mt-4">
          Professor Alexa Alice Joubin at the QS Higher Ed Summit in Washington,
          D.C., June 4, 2024
        </p>
      </div>
    </section>
  );
}
