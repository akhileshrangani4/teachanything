import { describe, it, expect } from "@jest/globals";
import { isMindMapRequest, mindMapSchema } from "@/lib/mindmap";

describe("isMindMapRequest", () => {
  it("matches common mind map phrasings", () => {
    const positives = [
      "make a mind map",
      "Make a mind map",
      "create a mind map on photosynthesis",
      "concept map",
      "show mind map for the water cycle",
      "mind map cellular respiration",
      "draw a concept map",
      "mindmap",
      "give me a mind map",
    ];
    for (const message of positives) {
      expect(isMindMapRequest(message)).toBe(true);
    }
  });

  it("does not match unrelated messages", () => {
    const negatives = [
      "what is a mind map",
      "I love mind maps",
      "explain the mind",
      "tell me about maps",
      "",
      "thanks!",
    ];
    for (const message of negatives) {
      expect(isMindMapRequest(message)).toBe(false);
    }
  });
});

describe("mindMapSchema", () => {
  const validMindMap = {
    title: "Photosynthesis",
    root: {
      label: "Photosynthesis",
      children: [
        {
          label: "Light Reactions",
          children: [{ label: "Chlorophyll" }, { label: "ATP" }],
        },
        {
          label: "Calvin Cycle",
          children: [{ label: "Carbon Fixation" }],
        },
      ],
    },
  };

  it("parses a well-formed nested map", () => {
    const result = mindMapSchema.safeParse(validMindMap);
    expect(result.success).toBe(true);
  });

  it("accepts a leaf root with no children", () => {
    const result = mindMapSchema.safeParse({
      title: "Single Concept",
      root: { label: "Mitochondria" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty label", () => {
    const result = mindMapSchema.safeParse({
      title: "Bad",
      root: { label: "" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing root", () => {
    const result = mindMapSchema.safeParse({
      title: "No root",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a node with more than eight children", () => {
    const result = mindMapSchema.safeParse({
      title: "Too many children",
      root: {
        label: "Center",
        children: Array.from({ length: 9 }, (_, i) => ({
          label: `Child ${i + 1}`,
        })),
      },
    });
    expect(result.success).toBe(false);
  });
});
