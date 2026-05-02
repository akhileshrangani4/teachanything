"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { UNIVERSITIES } from "./constants";

interface UsedBySectionProps {
  delay?: number;
}

export default function UsedBySection({ delay = 0.6 }: UsedBySectionProps) {
  const track = [...UNIVERSITIES, ...UNIVERSITIES];

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

        <div className="group relative w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)] [-webkit-mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
          <div
            className="flex w-max items-center gap-12 group-hover:[animation-play-state:paused]"
            style={{
              animation: "infinite-scroll 40s linear infinite",
              willChange: "transform",
            }}
          >
            {track.map((university, index) => (
              <Link
                key={`${university.name}-${index}`}
                href={university.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={university.name}
                className="flex-shrink-0 block opacity-80 hover:opacity-100 hover:scale-105 transition duration-300"
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
                  className="object-contain drop-shadow-xs"
                  quality={95}
                />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
