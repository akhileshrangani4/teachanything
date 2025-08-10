import { Router } from 'express';
import { optionalAuth } from '../middleware/auth';
import { ChatService } from '../services/chat.service';
import { z } from 'zod';
import type { Router as ExpressRouter } from 'express';

const router: ExpressRouter = Router();
const chatService = new ChatService();

// Chat message schema
const chatMessageSchema = z.object({
  message: z.string().min(1).max(4000),
  sessionId: z.string().optional(),
  metadata: z.object({}).optional()
});

// Send message to chatbot
router.post('/:chatbotId/message', optionalAuth, async (req: any, res) => {
  try {
    const validatedData = chatMessageSchema.parse(req.body);
    
    const response = await chatService.processMessage(
      req.params.chatbotId,
      validatedData.message,
      validatedData.sessionId,
      {
        userId: req.user?.id,
        metadata: validatedData.metadata,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
        referrer: req.headers['referer']
      }
    );

    res.json(response);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Send message to shared chatbot
router.post('/shared/:shareToken/message', async (req, res) => {
  try {
    const validatedData = chatMessageSchema.parse(req.body);
    
    const response = await chatService.processSharedMessage(
      req.params.shareToken,
      validatedData.message,
      validatedData.sessionId,
      {
        metadata: validatedData.metadata,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
        referrer: req.headers['referer']
      }
    );

    res.json(response);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Get conversation history
router.get('/:chatbotId/history/:sessionId', optionalAuth, async (req: any, res) => {
  try {
    const history = await chatService.getConversationHistory(
      req.params.chatbotId,
      req.params.sessionId,
      req.user?.id
    );
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
