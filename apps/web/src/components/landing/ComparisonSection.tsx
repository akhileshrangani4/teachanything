"use client";

import { motion } from "framer-motion";
import { BrandName } from "@/components/brand/BrandName";

export default function ComparisonSection() {
  const comparisonData = [
    {
      feature: "Audience",
      teachAnything: "For educators",
      commercial: "General purpose",
    },
    {
      feature: "Access to custom chatbot",
      teachAnything:
        "Shareable open-access link to custom chatbot, no login required",
      commercial: "User account required to see shared chatbots",
    },
    {
      feature: "Student login requirement",
      teachAnything: "Students do not need to login",
      commercial: "Students must create accounts",
    },
    {
      feature: "Privacy and data protection",
      teachAnything:
        "Full privacy protection; files & chats not used to train LLMs",
      commercial: "User data used for AI training",
    },
    {
      feature: "Openness of platform",
      teachAnything: "Open source, open access",
      commercial:
        "Free tier product is not open access; training data not transparent",
    },
    {
      feature: "Model choice",
      teachAnything: "Choice among open-source LLMs",
      commercial: "Locked in to one company's LLM",
    },
    {
      feature: "Control of system prompts",
      teachAnything: "Professors write system prompts",
      commercial: "Prompts controlled by provider",
    },
    {
      feature: "Role of faculty and students",
      teachAnything: "Faculty & students as designers, not just consumers",
      commercial: "Merely consumers of a predefined product",
    },
    {
      feature: "Building custom chatbots from files",
      teachAnything:
        "File uploads to create custom chatbots; files remain private",
      commercial:
        "File uploads available but files are used by AI companies for LLM training",
    },
    {
      feature: "Data usage for model training",
      teachAnything: "Files & chats not used to train LLMs",
      commercial: "Content is used to train LLM",
    },
    {
      feature: "Language support",
      teachAnything: "Multilingual",
      commercial: "Multilingual",
    },
  ];

  return (
    <section id="comparison" className="py-12 md:py-20 px-4 md:px-12 bg-white">
      <div className="max-w-7xl mx-auto">
        <motion.div
          className="text-center mb-8 md:mb-12"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-5xl font-serif font-light text-foreground mb-4">
            Why Choose <BrandName markClassName="font-sans font-semibold" />?
          </h2>
          <p className="text-base md:text-lg text-muted-foreground max-w-3xl mx-auto">
            See how we compare to commercial AI solutions. Built with privacy,
            openness, and educators in mind.
          </p>
        </motion.div>

        {/* Desktop Table View */}
        <motion.div
          className="hidden md:block"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7 }}
        >
          <table className="w-full bg-white border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-4 px-6 font-semibold text-foreground">
                  Feature
                </th>
                <th className="text-left py-4 px-6 font-semibold text-foreground bg-gray-100">
                  <BrandName markClassName="text-[0.42em]" /> (open access)
                </th>
                <th className="text-left py-4 px-6 font-semibold text-foreground">
                  Commercial AI
                </th>
              </tr>
            </thead>
            <tbody>
              {comparisonData.map((row, index) => (
                <motion.tr
                  key={row.feature}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.4, delay: index * 0.03 }}
                  className="border-b border-gray-200"
                >
                  <td className="py-4 px-6 text-sm font-medium text-foreground align-top">
                    {row.feature}
                  </td>
                  <td className="py-4 px-6 text-sm text-muted-foreground leading-relaxed align-top bg-gray-100">
                    {row.teachAnything}
                  </td>
                  <td className="py-4 px-6 text-sm text-muted-foreground leading-relaxed align-top">
                    {row.commercial}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </motion.div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-4">
          {comparisonData.map((row, index) => (
            <motion.div
              key={row.feature}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.4, delay: index * 0.03 }}
              className="bg-gray-50 rounded-lg p-4 border border-gray-200"
            >
              <h3 className="font-semibold text-foreground text-sm mb-3">
                {row.feature}
              </h3>
              <div className="space-y-3">
                <div className="bg-white rounded-md p-3 border border-gray-200">
                  <span className="text-xs font-medium text-primary uppercase tracking-wide">
                    <BrandName markClassName="text-[0.5em]" />
                  </span>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    {row.teachAnything}
                  </p>
                </div>
                <div className="bg-white rounded-md p-3 border border-gray-100">
                  <span className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wide">
                    Commercial AI
                  </span>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    {row.commercial}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          className="mt-8 md:mt-12 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
            Our commitment to open access, privacy, and educator empowerment
            sets us apart from commercial AI solutions that prioritize data
            collection and vendor lock-in.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
