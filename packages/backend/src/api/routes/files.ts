import { Router } from "express";
import multer from "multer";
import { authenticate } from "../middleware/auth";
import { FileService } from "../services/file.service";
import { z } from "zod";

const router: Router = Router();
const fileService = new FileService();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  fileFilter: (_req, file, cb) => {
    // Allow only text-based files
    const allowedMimes = [
      "text/plain",
      "text/markdown",
      "text/csv",
      "application/json",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only text-based files are allowed."));
    }
  },
});

// Upload file to chatbot
router.post(
  "/:chatbotId/upload",
  authenticate,
  upload.single("file"),
  async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }

      const result = await fileService.uploadFile(
        req.params.chatbotId,
        req.user.id,
        {
          fileName: req.file.originalname,
          fileType: req.file.mimetype,
          fileSize: req.file.size,
          buffer: req.file.buffer,
        },
      );

      return res.status(201).json(result);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  },
);

// Upload text content directly
router.post("/:chatbotId/upload-text", authenticate, async (req: any, res) => {
  try {
    const schema = z.object({
      fileName: z.string(),
      content: z.string(),
      fileType: z.string().default("text/plain"),
    });

    const validatedData = schema.parse(req.body);

    const result = await fileService.uploadTextContent(
      req.params.chatbotId,
      req.user.id,
      validatedData,
    );

    res.status(201).json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res
        .status(400)
        .json({ error: "Validation error", details: error.errors });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Get all files for a chatbot
router.get("/:chatbotId", authenticate, async (req: any, res) => {
  try {
    const files = await fileService.getChatbotFiles(
      req.params.chatbotId,
      req.user.id,
    );
    res.json(files);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a file
router.delete("/:chatbotId/:fileId", authenticate, async (req: any, res) => {
  try {
    await fileService.deleteFile(
      req.params.chatbotId,
      req.params.fileId,
      req.user.id,
    );
    res.status(204).send();
  } catch (error: any) {
    res
      .status(error.message.includes("not found") ? 404 : 500)
      .json({ error: error.message });
  }
});

// Get file content
router.get(
  "/:chatbotId/:fileId/content",
  authenticate,
  async (req: any, res) => {
    try {
      const file = await fileService.getFileContent(
        req.params.chatbotId,
        req.params.fileId,
        req.user.id,
      );
      res.json(file);
    } catch (error: any) {
      res
        .status(error.message.includes("not found") ? 404 : 500)
        .json({ error: error.message });
    }
  },
);

export default router;
