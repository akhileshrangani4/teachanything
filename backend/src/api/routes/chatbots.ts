import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { ChatbotService } from '../services/chatbot.service';
import { mapCamelToSnake, mapSnakeToCamel } from '../utils/field-mapper';
import { z } from 'zod';

const router = Router();
const chatbotService = new ChatbotService();

// Validation schemas
const createChatbotSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  systemPrompt: z.string().min(1),
  model: z.string().default('gpt-4o-mini'),
  temperature: z.number().min(0).max(100).default(70),
  maxTokens: z.number().min(100).max(4000).default(2000),
  welcomeMessage: z.string().optional(),
  suggestedQuestions: z.array(z.string()).optional(),
  embedSettings: z.object({
    theme: z.enum(['light', 'dark']).default('light'),
    position: z.enum(['bottom-right', 'bottom-left', 'top-right', 'top-left']).default('bottom-right'),
    buttonColor: z.string().default('#000000'),
    chatColor: z.string().default('#ffffff')
  }).optional()
});

// Get all chatbots for authenticated user
router.get('/', authenticate, async (req: any, res) => {
  try {
    const chatbots = await chatbotService.getUserChatbots(req.user.id);
    res.json(chatbots);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single chatbot
router.get('/:id', authenticate, async (req: any, res) => {
  try {
    const chatbot = await chatbotService.getChatbot(req.params.id, req.user.id);
    res.json(chatbot);
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

// Create new chatbot - SIMPLIFIED
router.post('/', authenticate, async (req: any, res) => {
  try {
    const validatedData = createChatbotSchema.parse(req.body);
    
    // Convert camelCase to snake_case and add user_id
    const dbData = {
      ...mapCamelToSnake(validatedData),
      user_id: req.user.id
    };
    
    const chatbot = await chatbotService.createChatbot(dbData);
    res.status(201).json(mapSnakeToCamel(chatbot));
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
    } else {
      console.error('Chatbot creation error:', error);
      res.status(500).json({ error: error.message });
    }
  }
});

// Update chatbot - FIXED
router.put('/:id', authenticate, async (req: any, res) => {
  try {
    const validatedData = createChatbotSchema.partial().parse(req.body);
    
    // Convert camelCase to snake_case for database
    const updateData: any = {};
    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.description !== undefined) updateData.description = validatedData.description;
    if (validatedData.systemPrompt !== undefined) updateData.system_prompt = validatedData.systemPrompt;
    if (validatedData.model !== undefined) updateData.model = validatedData.model;
    if (validatedData.temperature !== undefined) updateData.temperature = validatedData.temperature;
    if (validatedData.maxTokens !== undefined) updateData.max_tokens = validatedData.maxTokens;
    if (validatedData.welcomeMessage !== undefined) updateData.welcome_message = validatedData.welcomeMessage;
    if (validatedData.suggestedQuestions !== undefined) updateData.suggested_questions = validatedData.suggestedQuestions;
    if (validatedData.embedSettings !== undefined) updateData.embed_settings = validatedData.embedSettings;
    
    const chatbot = await chatbotService.updateChatbot(
      req.params.id,
      req.user.id,
      updateData
    );
    res.json(chatbot);
  } catch (error: any) {
    res.status(error.message.includes('not found') ? 404 : 500).json({ error: error.message });
  }
});

// Delete chatbot
router.delete('/:id', authenticate, async (req: any, res) => {
  try {
    await chatbotService.deleteChatbot(req.params.id, req.user.id);
    res.status(204).send();
  } catch (error: any) {
    res.status(error.message.includes('not found') ? 404 : 500).json({ error: error.message });
  }
});

// Generate share link
router.post('/:id/share', authenticate, async (req: any, res) => {
  try {
    const shareToken = await chatbotService.generateShareLink(req.params.id, req.user.id);
    const shareUrl = `${process.env.FRONTEND_URL}/chat/shared/${shareToken}`;
    res.json({ shareToken, shareUrl });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get chatbot by share token (public endpoint)
router.get('/shared/:shareToken', async (req: any, res) => {
  try {
    const chatbot = await chatbotService.getChatbotByShareToken(req.params.shareToken);
    if (!chatbot.share_token) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }
    res.json(chatbot);
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

export default router;
