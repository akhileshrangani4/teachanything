import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { authenticate } from '../middleware/auth';
import { AnalyticsService } from '../services/analytics.service';

const router: ExpressRouter = Router();
const analyticsService = new AnalyticsService();

// Get chatbot analytics overview
router.get('/chatbot/:chatbotId', authenticate, async (req: any, res) => {
  try {
    const timeRange = req.query.timeRange || '7d'; // 7d, 30d, 90d, all
    
    const analytics = await analyticsService.getChatbotAnalytics(
      req.params.chatbotId,
      req.user.id,
      timeRange
    );
    
    res.json(analytics);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get user's overall analytics
router.get('/overview', authenticate, async (req: any, res) => {
  try {
    const timeRange = req.query.timeRange || '7d';
    
    const analytics = await analyticsService.getUserAnalytics(
      req.user.id,
      timeRange
    );
    
    res.json(analytics);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get conversation analytics
router.get('/conversations/:chatbotId', authenticate, async (req: any, res) => {
  try {
    const { startDate, endDate, limit = 100 } = req.query;
    
    const conversations = await analyticsService.getConversationAnalytics(
      req.params.chatbotId,
      req.user.id,
      {
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: parseInt(limit as string)
      }
    );
    
    res.json(conversations);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get message volume over time
router.get('/messages/:chatbotId', authenticate, async (req: any, res) => {
  try {
    const { interval = 'day' } = req.query; // hour, day, week, month
    
    const messageVolume = await analyticsService.getMessageVolume(
      req.params.chatbotId,
      req.user.id,
      interval as string
    );
    
    res.json(messageVolume);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get popular questions/topics
router.get('/topics/:chatbotId', authenticate, async (req: any, res) => {
  try {
    const topics = await analyticsService.getPopularTopics(
      req.params.chatbotId,
      req.user.id
    );
    
    res.json(topics);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Track custom event
router.post('/event', async (req, res) => {
  try {
    const { chatbotId, eventType, eventData, sessionId } = req.body;
    
    await analyticsService.trackEvent(
      chatbotId,
      eventType,
      eventData,
      sessionId
    );
    
    res.status(201).json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
