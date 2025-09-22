import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import path from "path";
import dotenv from "dotenv";

// Load environment variables from root
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

// Import routes
import authRoutes from "./routes/auth";
import chatbotRoutes from "./routes/chatbots";
import chatRoutes from "./routes/chat";
import filesRoutes from "./routes/files";
import embedRoutes from "./routes/embed";
import analyticsRoutes from "./routes/analytics";
import type { Express } from "express";

const app: Express = express();
const PORT = process.env.BACKEND_PORT || 3000;

// Trust proxy headers (required for Railway, Heroku, etc.)
app.set("trust proxy", true);

// Middleware
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") || "*",
    credentials: true,
  }),
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});

const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // Limit each IP to 20 chat requests per minute
  message: "Too many chat requests, please slow down.",
});

app.use("/api/", limiter);
app.use("/api/chat", chatLimiter);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/chatbots", chatbotRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/files", filesRoutes);
app.use("/api/embed", embedRoutes);
app.use("/api/analytics", analyticsRoutes);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
      error: err.message || "Internal server error",
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
  },
);

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
});

export default app;
