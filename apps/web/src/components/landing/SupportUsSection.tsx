"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { SiGithub } from "react-icons/si";
import { FaHeart } from "react-icons/fa";
import Image from "next/image";

const FEATURED_IN = [
  {
    name: "New York Times",
    url: "/assets/press/nyt-article.pdf",
    logo: "/assets/logos/nyt-logo.png",
    alt: "The New York Times logo - Link to article about AI in education",
  },
  {
    name: "JSTOR",
    url: "https://about.jstor.org/blog/fostering-trust-in-ai/",
    logo: "/assets/logos/jstor-logo.svg",
    alt: "JSTOR logo - Link to article about fostering trust in AI",
  },
  {
    name: "EdTech",
    url: "https://edtechmagazine.com/higher/article/2025/03/ai-powered-teaching-assistants-perfcon",
    logo: "/assets/logos/edtech-logo.png",
    alt: "EdTech Magazine logo - Link to article about AI-powered teaching assistants",
  },
  {
    name: "Phys.Org",
    url: "https://phys.org/news/2025-02-rethinking-ai-higher-professor-foster.html",
    logo: "/assets/logos/physorg-logo.png",
    alt: "Phys.Org logo - Link to article about rethinking AI in higher education",
  },
  {
    name: "SAIL",
    url: "https://youtu.be/9hxBziNuf0k?si=YgLbqSfUn01_AS4a",
    logo: "/assets/logos/sail-logo.png",
    alt: "SAIL (Stanford AI Lab) logo - Link to video about AI in education",
  },
  {
    name: "Springer",
    url: "https://link.springer.com/chapter/10.1007/978-3-031-65691-0_11",
    logo: "/assets/logos/springer-logo.png",
    alt: "Springer logo - Link to published research chapter",
  },
  {
    name: "QS",
    url: "https://www.youtube.com/watch?v=By6UlskJ30Y",
    logo: "/assets/logos/qs-logo.png",
    alt: "QS Higher Ed Summit logo - Link to presentation video",
  },
  {
    name: "GW Media Relations",
    url: "https://youtu.be/hj3boR5-cr8?si=OrQ2ACfve5QbZezC",
    logo: "/assets/logos/gw-media-logo.png",
    alt: "George Washington University Media Relations logo - Link to feature video",
  },
  {
    name: "Fulbright",
    url: "https://youtu.be/Sl2wkXK9llk?si=mZfGAEO-eYMx9wvR",
    logo: "/assets/logos/fulbright-logo.png",
    alt: "Fulbright logo - Link to presentation about open-access AI",
  },
  {
    name: "GW Today",
    url: "https://gwtoday.gwu.edu/ai-action-faculty-experiment-tech-teaching-tools",
    logo: "/assets/logos/gw-today-logo.png",
    alt: "GW Today logo - Link to article about faculty experimenting with AI teaching tools",
  },
  {
    name: "Higher Ed Dive",
    url: "https://www.highereddive.com/news/google-ai-initiative-texas-am/807899/",
    logo: "/assets/logos/higher-ed-logo.svg",
    alt: "Higher Ed Dive logo - Link to article about Google AI initiative",
  },
];

export default function SupportUsSection() {
  return (
    <section id="support-us" className="py-32 px-6 md:px-12 bg-white">
      <div className="max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7 }}
        >
          {/* Header */}
          <h2 className="text-4xl md:text-6xl font-serif font-light text-foreground mb-6 leading-tight">
            Open source.
            <br />
            Forever free.
          </h2>
          <p className="text-muted-foreground text-lg mb-12 leading-[1.8] max-w-3xl mx-auto">
            Built by educators for educators. Contribute to best practices.
            Share pedagogical ideas. Collaborate on GitHub. Use our hosted AI or
            host it yourself.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-2 px-10 py-6 text-base rounded-full font-medium"
              >
                <Link
                  href={
                    process.env.NEXT_PUBLIC_GITHUB_URL ||
                    "https://github.com/akhileshrangani4/teachanything"
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View our code on GitHub <SiGithub size={24} />
                </Link>
              </Button>
            </motion.div>

            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-2 px-10 py-6 text-base rounded-full font-medium border-red-500/20 text-red-600 hover:border-red-500/40 hover:bg-red-50 hover:text-red-700"
              >
                <Link
                  href={
                    process.env.NEXT_PUBLIC_DONATION_URL ||
                    "https://www.gofundme.com/f/empower-educators-with-openaccess-ai"
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Donate to our project <FaHeart size={20} />
                </Link>
              </Button>
            </motion.div>
          </div>

          <motion.p
            className="text-muted-foreground text-sm mb-12"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            No credit card required • Academic emails preferred
          </motion.p>

          {/* Support Text */}
          <motion.p
            className="text-muted-foreground text-base mb-16 leading-[1.8] max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            Currently, this open-access project relies on donation and its
            community of forward thinkers and passionate students. The
            project&apos;s earlier phase was supported by George Mason
            University, Washington Research Library Consortium, Public Interest
            Technology Scholar program, the NSF Institute for Trustworthy AI in
            Law & Society, and George Washington University.
          </motion.p>

          {/* Featured In Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <h3 className="text-2xl md:text-3xl font-serif font-light text-foreground mb-8">
              Our open-access project has been featured in
            </h3>
            <div className="flex flex-wrap justify-center gap-8 max-w-3xl mx-auto">
              {FEATURED_IN.map((feature, index) => (
                <motion.a
                  key={feature.name}
                  href={feature.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="grayscale hover:grayscale-0 transition-[filter] duration-200 will-change-[filter,transform]"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 0.6, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.4, delay: 0.6 + index * 0.1 }}
                  whileHover={{
                    scale: 1.1,
                    opacity: 1,
                    transition: { duration: 0.15 },
                  }}
                >
                  <Image
                    src={feature.logo}
                    alt={feature.alt}
                    width={120}
                    height={60}
                    className="w-auto h-12 object-contain"
                  />
                </motion.a>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
