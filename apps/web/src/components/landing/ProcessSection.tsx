"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";

export default function ProcessSection() {
  const [open, setOpen] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);

  const steps = [
    {
      number: "01",
      title: "Create",
      description:
        "Sign up and create your first chatbot in minutes. No technical skills needed. Select from open-source LLMs such as Llama 3.3, Qwen 3, and GPT-OSS.",
    },
    {
      number: "02",
      title: "Upload",
      description:
        "Add your course materials. Our AI processes and indexes everything automatically.",
    },
    {
      number: "03",
      title: "Share",
      description:
        "Share the link with your students and watch engagement soar. Or embed the chatbot on your own website with automatically-generated HTML or Javascript code.",
    },
  ];

  const diagrams = [
    {
      src: "/diagrams/architecture/system_architecture_simple.png",
      title: "System Architecture",
      description:
        "Our architecture leverages modern serverless infrastructure to deliver a scalable, efficient platform. Built with Next.js, tRPC, and Supabase, the system seamlessly integrates multiple open-source LLMs with vector-based retrieval for accurate, context-aware responses.",
    },
    {
      src: "/diagrams/flowcharts/professorsimple.png",
      title: "Professor Flow Chart",
      description:
        "Professors can easily create and customize chatbots by uploading course materials, selecting an LLM, and configuring behavior settings. The intuitive workflow ensures your chatbot is ready to deploy in minutes.",
    },
    {
      src: "/diagrams/flowcharts/studentsimple.png",
      title: "Student Flow Chart",
      description:
        "Students interact with chatbots through a clean, accessible interface. Each query is processed using RAG technology to retrieve relevant information from uploaded materials, ensuring accurate and contextual responses.",
    },
  ];

  const slides = diagrams.map((diagram) => ({
    src: diagram.src,
    alt: diagram.title,
  }));

  return (
    <section id="how-it-works" className="py-20 px-6 md:px-12 bg-white">
      <div className="max-w-7xl mx-auto">
        <motion.h2
          className="text-5xl font-serif font-light text-foreground mb-12 text-center"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
        >
          How It Works
        </motion.h2>

        <div className="grid md:grid-cols-3 gap-12 mb-20">
          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: index * 0.15 }}
            >
              <motion.div
                className="text-6xl font-serif font-light text-gray-300 mb-4"
                initial={{ opacity: 0, scale: 0.5 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.5, delay: index * 0.15 + 0.2 }}
              >
                {step.number}
              </motion.div>
              <h3 className="text-2xl font-semibold text-foreground mb-3">
                {step.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Diagrams Section */}
        <motion.div
          className="mt-16 border-t border-gray-200 pt-12"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
        >
          <div className="space-y-6">
            {diagrams.map((diagram, index) => (
              <motion.div
                key={diagram.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="group"
              >
                <button
                  onClick={() => {
                    setPhotoIndex(index);
                    setOpen(true);
                  }}
                  className="text-left w-full hover:bg-gray-50 p-4 rounded-lg transition-colors"
                >
                  <h3 className="text-xl font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                    {diagram.title} →
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {diagram.description}
                  </p>
                </button>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Lightbox Modal */}
        <Lightbox
          open={open}
          close={() => setOpen(false)}
          slides={slides}
          index={photoIndex}
          plugins={[Zoom]}
          zoom={{
            maxZoomPixelRatio: 3,
            zoomInMultiplier: 2,
            scrollToZoom: true,
          }}
        />
      </div>
    </section>
  );
}
