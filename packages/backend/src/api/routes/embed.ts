import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { EmbedService } from "../services/embed.service";

const router: Router = Router();
const embedService = new EmbedService();

// Get embed code for chatbot
router.get("/:chatbotId/code", authenticate, async (req: any, res) => {
  try {
    const embedCode = await embedService.generateEmbedCode(
      req.params.chatbotId,
      req.user.id,
      {
        type: req.query.type || "iframe", // 'iframe' or 'script'
        ...req.query,
      },
    );
    res.json({ embedCode });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Serve widget script
router.get("/widget.js", (_req, res) => {
  res.type("application/javascript");
  res.send(embedService.getWidgetScript());
});

// Serve widget styles
router.get("/widget.css", (_req, res) => {
  res.type("text/css");
  res.send(embedService.getWidgetStyles());
});

export default router;
