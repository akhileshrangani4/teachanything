import { describe, it, expect } from "@jest/globals";
import { getTableConfig } from "drizzle-orm/pg-core";
import {
  user,
  session,
  chatbots,
  fileChunks,
  chatbotFileAssociations,
  userStatusEnum,
  userRoleEnum,
  processingStatusEnum,
} from "../schema";

describe("Database Schema", () => {
  describe("Enums", () => {
    it("defines userStatusEnum with correct values", () => {
      expect(userStatusEnum.enumValues).toEqual([
        "pending",
        "approved",
        "rejected",
      ]);
    });

    it("defines userRoleEnum with correct values", () => {
      expect(userRoleEnum.enumValues).toEqual(["user", "admin"]);
    });

    it("defines processingStatusEnum with correct values", () => {
      expect(processingStatusEnum.enumValues).toEqual([
        "pending",
        "processing",
        "completed",
        "failed",
      ]);
    });
  });

  describe("Tables", () => {
    it("defines user table with required columns", () => {
      const columns = Object.keys(user);
      expect(columns).toContain("id");
      expect(columns).toContain("email");
      expect(columns).toContain("name");
      expect(columns).toContain("status");
      expect(columns).toContain("role");
      expect(columns).toContain("createdAt");
    });

    it("defines session table with required columns", () => {
      const columns = Object.keys(session);
      expect(columns).toContain("id");
      expect(columns).toContain("userId");
      expect(columns).toContain("token");
      expect(columns).toContain("expiresAt");
    });

    it("defines chatbots table with required columns", () => {
      const columns = Object.keys(chatbots);
      expect(columns).toContain("id");
      expect(columns).toContain("userId");
      expect(columns).toContain("name");
    });
  });

  describe("Indexes and Constraints", () => {
    const fcConfig = getTableConfig(fileChunks);
    const cfaConfig = getTableConfig(chatbotFileAssociations);

    it("defines HNSW index on fileChunks.embedding with correct parameters", () => {
      const hnswIndex = fcConfig.indexes.find(
        (i) => i.config.name === "file_chunks_embedding_idx",
      );
      expect(hnswIndex).toBeDefined();
      expect(hnswIndex!.config.method).toBe("hnsw");
      expect(hnswIndex!.config.with).toEqual(
        expect.objectContaining({ m: 24, ef_construction: 128 }),
      );
    });

    it("defines B-tree index on fileChunks.fileId", () => {
      const fileIdIndex = fcConfig.indexes.find(
        (i) => i.config.name === "file_chunks_file_id_idx",
      );
      expect(fileIdIndex).toBeDefined();
    });

    it("defines unique constraint on fileChunks(fileId, chunkIndex)", () => {
      const chunkUnique = fcConfig.uniqueConstraints.find(
        (u) => u.name === "file_chunks_file_id_chunk_index_unique",
      );
      expect(chunkUnique).toBeDefined();
    });

    it("defines unique index on chatbotFileAssociations(chatbotId, fileId)", () => {
      const cfaIndex = cfaConfig.indexes.find(
        (i) =>
          i.config.name ===
          "chatbot_file_associations_chatbot_id_file_id_idx",
      );
      expect(cfaIndex).toBeDefined();
      expect(cfaIndex!.config.unique).toBe(true);
    });
  });
});
