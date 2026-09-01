"use client";

import { motion } from "framer-motion";

// Alphabetical by the main keyword in each name. Rendered as three columns
// that each read top-to-bottom, so the order survives the mobile stack.
const UNIVERSITY_NAMES = [
  "Arab Open University",
  "Bar-Ilan University, Israel",
  "UC Berkeley",
  "University of Bristol",
  "SUNY Buffalo",
  "Cairo University, Egypt",
  "University of Calgary, Canada",
  "Case Western Reserve University",
  "UNC Chapel Hill",
  "National Chengchi University, Taiwan",
  "City University of New York",
  "University of Erlangen–Nuremberg, Germany",
  "George Mason University",
  "George Washington University",
  "Georgetown University",
  "Goldsmiths, University of London",
  "University of Guelph, Canada",
  "University of Houston",
  "University of Inland Norway",
  "Kansai University, Japan",
  "Central University of Karnataka, India",
  "King’s College London",
  "Kinnaird College for Women, Pakistan",
  "University of Maryland",
  "Université de Neuchâtel, Switzerland",
  "Universitetet i Oslo",
  "Pharos University in Alexandria, Egypt",
  "University of Rhode Island",
  "University of Sussex",
  "University of Tennessee Knoxville",
  "University of Valencia, Spain",
  "University of Warsaw, Poland",
  "University of Winnipeg, Canada",
] as const;

const COLUMN_COUNT = 3;
const COLUMN_LENGTH = Math.ceil(UNIVERSITY_NAMES.length / COLUMN_COUNT);

const COLUMNS = Array.from({ length: COLUMN_COUNT }, (_, column) =>
  UNIVERSITY_NAMES.slice(
    column * COLUMN_LENGTH,
    column * COLUMN_LENGTH + COLUMN_LENGTH,
  ),
);

export default function TrustedBySection() {
  return (
    <section id="trusted-by" className="py-20 px-6 md:px-12 bg-white">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-5xl font-serif font-light text-foreground mb-12 text-center">
            Trusted by Professors Worldwide at
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-12 gap-y-3">
            {COLUMNS.map((column) => (
              <ul key={column[0]} className="flex flex-col gap-3">
                {column.map((name) => (
                  <li
                    key={name}
                    className="text-base text-muted-foreground text-center md:text-left"
                  >
                    {name}
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
