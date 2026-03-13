"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { UNIVERSITIES } from "./constants";

interface UsedBySectionProps {
  delay?: number;
}

const DUPLICATION_COUNT = 4;

export default function UsedBySection({ delay = 0.6 }: UsedBySectionProps) {
  // Duplicate universities array for smooth infinite scroll
  const duplicatedUniversities = Array.from(
    { length: DUPLICATION_COUNT },
    () => UNIVERSITIES,
  ).flat();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, delay }}
      className="w-full pb-8 md:pb-12 overflow-hidden"
    >
      <div className="flex flex-col items-center gap-6 px-4">
        <p className="text-sm font-medium text-black/70 whitespace-nowrap z-10">
          Trusted By Professors At
        </p>

        <div className="relative w-full overflow-hidden">
          <motion.div
            className="flex items-center gap-12"
            animate={{
              x: ["0%", "-100%"],
            }}
            transition={{
              x: {
                repeat: Infinity,
                repeatType: "loop",
                duration: 40,
                ease: "linear",
              },
            }}
          >
            {duplicatedUniversities.map((university, index) => (
              <motion.div
                key={`${university.name}-${index}`}
                whileHover={{
                  scale: 1.1,
                  y: -5,
                  filter: "brightness(1.1)",
                }}
                transition={{ duration: 0.3 }}
                className="flex-shrink-0 cursor-pointer"
                style={{ willChange: "transform" }}
              >
                <Link
                  href={university.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Image
                    src={university.logo}
                    alt={university.name}
                    width={university.width}
                    height={university.height}
                    style={{
                      width: `${university.width * 0.7}px`,
                      height: "auto",
                    }}
                    className="object-contain opacity-70 hover:opacity-100 transition-opacity duration-300 drop-shadow-xs"
                    quality={95}
                  />
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
