import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { ChatbotService } from "../services/chatbot.service";
import { z } from "zod";

const router: Router = Router();
const chatbotService = new ChatbotService();

// Validation schemas
const createChatbotSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  systemPrompt: z.string().min(1),
  model: z.string().default("gpt-4o-mini"),
  temperature: z.number().min(0).max(100).default(70),
  maxTokens: z.number().min(100).max(4000).default(2000),
  welcomeMessage: z.string().optional(),
  suggestedQuestions: z.array(z.string()).optional(),
  embedSettings: z
    .object({
      theme: z.enum(["light", "dark"]).default("light"),
      position: z
        .enum(["bottom-right", "bottom-left", "top-right", "top-left"])
        .default("bottom-right"),
      buttonColor: z.string().default("#000000"),
      chatColor: z.string().default("#ffffff"),
    })
    .optional(),
});

// Get all chatbots for authenticated user
router.get("/", authenticate, async (req: any, res) => {
  try {
    const chatbots = await chatbotService.getUserChatbots(req.user.id);
    res.json(chatbots);
  } catch (error: any) {
    console.error("Error fetching chatbots:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get specific chatbot
router.get("/:id", authenticate, async (req: any, res) => {
  try {
    const chatbot = await chatbotService.getChatbot(req.params.id, req.user.id);
    res.json(chatbot);
  } catch (error: any) {
    console.error("Error fetching chatbot:", error);
    res.status(500).json({ error: error.message });
  }
});

// Create new chatbot
router.post("/", authenticate, async (req: any, res) => {
  try {
    const validatedData = createChatbotSchema.parse(req.body);

    // Map camelCase to snake_case for database
    const dbData = {
      name: validatedData.name,
      description: validatedData.description,
      system_prompt: validatedData.systemPrompt,
      model: validatedData.model,
      temperature: validatedData.temperature,
      max_tokens: validatedData.maxTokens,
      welcome_message: validatedData.welcomeMessage,
      suggested_questions: validatedData.suggestedQuestions,
      embed_settings: validatedData.embedSettings,
      user_id: req.user.id,
    };

    const chatbot = await chatbotService.createChatbot(dbData);
    res.status(201).json(chatbot);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res
        .status(400)
        .json({ error: "Validation error", details: error.errors });
    } else {
      console.error("Chatbot creation error:", error);
      res.status(500).json({ error: error.message });
    }
  }
});

// Update chatbot
router.put("/:id", authenticate, async (req: any, res) => {
  try {
    const validatedData = createChatbotSchema.partial().parse(req.body);

    // Map camelCase to snake_case for database
    const dbData: any = {};
    if (validatedData.name !== undefined) dbData.name = validatedData.name;
    if (validatedData.description !== undefined)
      dbData.description = validatedData.description;
    if (validatedData.systemPrompt !== undefined)
      dbData.system_prompt = validatedData.systemPrompt;
    if (validatedData.model !== undefined) dbData.model = validatedData.model;
    if (validatedData.temperature !== undefined)
      dbData.temperature = validatedData.temperature;
    if (validatedData.maxTokens !== undefined)
      dbData.max_tokens = validatedData.maxTokens;
    if (validatedData.welcomeMessage !== undefined)
      dbData.welcome_message = validatedData.welcomeMessage;
    if (validatedData.suggestedQuestions !== undefined)
      dbData.suggested_questions = validatedData.suggestedQuestions;
    if (validatedData.embedSettings !== undefined)
      dbData.embed_settings = validatedData.embedSettings;

    const chatbot = await chatbotService.updateChatbot(
      req.params.id,
      req.user.id,
      dbData,
    );
    res.json(chatbot);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res
        .status(400)
        .json({ error: "Validation error", details: error.errors });
    } else {
      console.error("Chatbot update error:", error);
      res.status(500).json({ error: error.message });
    }
  }
});

// Delete chatbot
router.delete("/:id", authenticate, async (req: any, res) => {
  try {
    await chatbotService.deleteChatbot(req.params.id, req.user.id);
    res.status(204).send();
  } catch (error: any) {
    res
      .status(error.message.includes("not found") ? 404 : 500)
      .json({ error: error.message });
  }
});

// Generate share link
router.post("/:id/share", authenticate, async (req: any, res) => {
  try {
    const shareToken = await chatbotService.generateShareLink(
      req.params.id,
      req.user.id,
    );
    const shareUrl = `${process.env.FRONTEND_URL}/chat/shared/${shareToken}`;
    res.json({ shareToken, shareUrl });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get chatbot by share token (public endpoint)
router.get("/shared/:shareToken", async (req: any, res) => {
  try {
    const chatbot = await chatbotService.getChatbotByShareToken(
      req.params.shareToken,
    );
    if (!chatbot.share_token) {
      return res.status(404).json({ error: "Chatbot not found" });
    }
    return res.json(chatbot);
  } catch (error: any) {
    return res.status(404).json({ error: error.message });
  }
});

export default router;
