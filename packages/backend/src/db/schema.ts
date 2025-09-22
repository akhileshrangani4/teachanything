import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  vector,
  integer,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Users table - Updated with auth fields
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  password_hash: text("password_hash").notNull(),
  reset_token: text("reset_token"),
  reset_token_expiry: timestamp("reset_token_expiry"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// Chatbots table
export const chatbots = pgTable("chatbots", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  description: text("description"),
  system_prompt: text("system_prompt").notNull(),
  model: text("model").notNull().default("gpt-4o-mini"), // AI model to use
  temperature: integer("temperature").default(70), // 0-100, will be divided by 100
  max_tokens: integer("max_tokens").default(2000),
  welcome_message: text("welcome_message"),
  suggested_questions: jsonb("suggested_questions").default([]), // Array of strings
  share_token: text("share_token").unique(), // For shareable links
  embed_settings: jsonb("embed_settings").default({
    theme: "light",
    position: "bottom-right",
    buttonColor: "#000000",
    chatColor: "#ffffff",
  }),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// Chatbot files (context files)
export const chatbotFiles = pgTable("chatbot_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  chatbot_id: uuid("chatbot_id")
    .references(() => chatbots.id, { onDelete: "cascade" })
    .notNull(),
  file_name: text("file_name").notNull(),
  file_type: text("file_type").notNull(),
  file_size: integer("file_size").notNull(), // in bytes
  content: text("content").notNull(), // Store file content as text
  embedding: vector("embedding", { dimensions: 1536 }), // For semantic search
  metadata: jsonb("metadata").default({}),
  created_at: timestamp("created_at").defaultNow(),
});

// table for file chunks
export const fileChunks = pgTable("file_chunks", {
  id: uuid("id").primaryKey().defaultRandom(),
  file_id: uuid("file_id")
    .references(() => chatbotFiles.id, { onDelete: "cascade" })
    .notNull(),
  chatbot_id: uuid("chatbot_id")
    .references(() => chatbots.id, { onDelete: "cascade" })
    .notNull(),
  chunk_index: integer("chunk_index").notNull(), // Order of chunk in original document
  content: text("content").notNull(), // Chunk text content
  embedding: vector("embedding", { dimensions: 1536 }), // Embedding for this chunk
  metadata: jsonb("metadata").default({}), // Additional metadata (page number, section, etc.)
  token_count: integer("token_count"), // Number of tokens in this chunk
  created_at: timestamp("created_at").defaultNow(),
});

// Conversations
export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  chatbot_id: uuid("chatbot_id")
    .references(() => chatbots.id, { onDelete: "cascade" })
    .notNull(),
  session_id: text("session_id").notNull(), // For tracking individual chat sessions
  user_agent: text("user_agent"),
  ip_address: text("ip_address"),
  referrer: text("referrer"),
  metadata: jsonb("metadata").default({}),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// Messages
export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversation_id: uuid("conversation_id")
    .references(() => conversations.id, { onDelete: "cascade" })
    .notNull(),
  role: text("role").notNull(), // 'user', 'assistant', 'system'
  content: text("content").notNull(),
  metadata: jsonb("metadata").default({}), // Can store token usage, model used, etc.
  created_at: timestamp("created_at").defaultNow(),
});

// Analytics
export const analytics = pgTable("analytics", {
  id: uuid("id").primaryKey().defaultRandom(),
  chatbot_id: uuid("chatbot_id")
    .references(() => chatbots.id, { onDelete: "cascade" })
    .notNull(),
  event_type: text("event_type").notNull(), // 'session_start', 'message_sent', 'widget_opened', etc.
  event_data: jsonb("event_data").default({}),
  session_id: text("session_id"),
  created_at: timestamp("created_at").defaultNow(),
});

// Define relations
export const usersRelations = relations(users, ({ many }) => ({
  chatbots: many(chatbots),
}));

export const chatbotsRelations = relations(chatbots, ({ one, many }) => ({
  user: one(users, {
    fields: [chatbots.user_id],
    references: [users.id],
  }),
  files: many(chatbotFiles),
  conversations: many(conversations),
  analytics: many(analytics),
}));

export const chatbotFilesRelations = relations(
  chatbotFiles,
  ({ one, many }) => ({
    chatbot: one(chatbots, {
      fields: [chatbotFiles.chatbot_id],
      references: [chatbots.id],
    }),
    chunks: many(fileChunks),
  }),
);

export const fileChunksRelations = relations(fileChunks, ({ one }) => ({
  file: one(chatbotFiles, {
    fields: [fileChunks.file_id],
    references: [chatbotFiles.id],
  }),
  chatbot: one(chatbots, {
    fields: [fileChunks.chatbot_id],
    references: [chatbots.id],
  }),
}));

export const conversationsRelations = relations(
  conversations,
  ({ one, many }) => ({
    chatbot: one(chatbots, {
      fields: [conversations.chatbot_id],
      references: [chatbots.id],
    }),
    messages: many(messages),
  }),
);

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversation_id],
    references: [conversations.id],
  }),
}));
