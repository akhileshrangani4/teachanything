"use client";

import { motion } from "framer-motion";

/**
 * Alphabetical by the main keyword in each name, as supplied by Prof Joubin.
 * Names only, no logos, no institutional typefaces. Countries are shown as
 * a secondary label to make the international reach legible at a glance; the
 * ones Prof Joubin did not spell out are filled in here.
 */
const UNIVERSITIES = [
  { name: "Arab Open University", country: "Saudi Arabia" },
  { name: "Bar-Ilan University", country: "Israel" },
  { name: "UC Berkeley", country: "United States" },
  { name: "University of Bristol", country: "United Kingdom" },
  { name: "SUNY Buffalo", country: "United States" },
  { name: "Cairo University", country: "Egypt" },
  { name: "University of Calgary", country: "Canada" },
  { name: "Case Western Reserve University", country: "United States" },
  { name: "UNC Chapel Hill", country: "United States" },
  { name: "National Chengchi University", country: "Taiwan" },
  { name: "City University of New York", country: "United States" },
  { name: "University of Erlangen–Nuremberg", country: "Germany" },
  { name: "George Mason University", country: "United States" },
  { name: "George Washington University", country: "United States" },
  { name: "Georgetown University", country: "United States" },
  { name: "Goldsmiths, University of London", country: "United Kingdom" },
  { name: "University of Guelph", country: "Canada" },
  { name: "University of Houston", country: "United States" },
  { name: "University of Inland Norway", country: "Norway" },
  { name: "Kansai University", country: "Japan" },
  { name: "Central University of Karnataka", country: "India" },
  { name: "King’s College London", country: "United Kingdom" },
  { name: "Kinnaird College for Women", country: "Pakistan" },
  { name: "University of Maryland", country: "United States" },
  { name: "Université de Neuchâtel", country: "Switzerland" },
  { name: "Universitetet i Oslo", country: "Norway" },
  { name: "Pharos University in Alexandria", country: "Egypt" },
  { name: "University of Rhode Island", country: "United States" },
  { name: "University of Sussex", country: "United Kingdom" },
  { name: "University of Tennessee Knoxville", country: "United States" },
  { name: "University of Valencia", country: "Spain" },
  { name: "University of Warsaw", country: "Poland" },
  { name: "University of Winnipeg", country: "Canada" },
] as const;

export default function TrustedBySection() {
  return (
    <section id="trusted-by" className="py-32 px-6 md:px-12 bg-white">
      <div className="max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl md:text-5xl font-serif font-light text-foreground">
            Trusted by Professors Worldwide at
          </h2>
        </motion.div>

        {/* Columns flow top-to-bottom, so the alphabetical order survives the
            collapse to a single column on small screens. */}
        <motion.ul
          className="columns-1 sm:columns-2 lg:columns-3 gap-x-16 border-t border-border"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, delay: 0.15 }}
        >
          {UNIVERSITIES.map((university) => (
            <li
              key={university.name}
              className="break-inside-avoid border-b border-border py-4"
            >
              <span className="block text-base leading-snug text-foreground">
                {university.name}
              </span>
              <span className="mt-1 block text-xs uppercase tracking-wider text-muted-foreground">
                {university.country}
              </span>
            </li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}
