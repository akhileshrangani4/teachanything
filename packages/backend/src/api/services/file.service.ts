import { db, chatbots, chatbotFiles } from "../../db";
import { eq, and } from "drizzle-orm";
import { RAGService } from "./rag.service";

export class FileService {
  private ragService: RAGService;

  constructor() {
    this.ragService = new RAGService();
  }

  async uploadFile(chatbotId: string, userId: string, fileData: any) {
    // Verify chatbot ownership
    const [chatbot] = await db
      .select()
      .from(chatbots)
      .where(and(eq(chatbots.id, chatbotId), eq(chatbots.user_id, userId)))
      .limit(1);

    if (!chatbot) {
      throw new Error("Chatbot not found or unauthorized");
    }

    try {
      // Extract content using RAG service
      const content = await this.ragService.extractContent(
        fileData.buffer,
        fileData.fileType,
      );

      // Store file record first
      const [file] = await db
        .insert(chatbotFiles)
        .values({
          chatbot_id: chatbotId,
          file_name: fileData.fileName,
          file_type: fileData.fileType,
          file_size: fileData.fileSize,
          content: content.substring(0, 10000), // Store first 10k chars for preview
          embedding: null, // We'll store embeddings in chunks instead
          metadata: {
            uploadedBy: userId,
            originalName: fileData.fileName,
            extractedAt: new Date().toISOString(),
          },
        })
        .returning();

      // Process and chunk the content for RAG
      await this.ragService.processFileContent(file.id, chatbotId, content, {
        fileName: fileData.fileName,
        fileType: fileData.fileType,
        uploadedBy: userId,
      });

      return {
        id: file.id,
        fileName: file.file_name,
        fileType: file.file_type,
        fileSize: file.file_size,
        uploadedAt: file.created_at,
        status: "processed",
      };
    } catch (error: any) {
      console.error("File upload error:", error);
      throw new Error(`Failed to process file: ${error.message}`);
    }
  }

  async uploadTextContent(chatbotId: string, userId: string, data: any) {
    // Verify chatbot ownership
    const [chatbot] = await db
      .select()
      .from(chatbots)
      .where(and(eq(chatbots.id, chatbotId), eq(chatbots.user_id, userId)))
      .limit(1);

    if (!chatbot) {
      throw new Error("Chatbot not found or unauthorized");
    }

    try {
      // Store file record
      const [file] = await db
        .insert(chatbotFiles)
        .values({
          chatbot_id: chatbotId,
          file_name: data.fileName,
          file_type: data.fileType,
          file_size: Buffer.byteLength(data.content, "utf8"),
          content: data.content.substring(0, 10000), // Store first 10k chars for preview
          embedding: null,
          metadata: {
            uploadedBy: userId,
            uploadedAt: new Date().toISOString(),
          },
        })
        .returning();

      // Process and chunk the content for RAG
      await this.ragService.processFileContent(
        file.id,
        chatbotId,
        data.content,
        {
          fileName: data.fileName,
          fileType: data.fileType,
          uploadedBy: userId,
        },
      );

      return {
        id: file.id,
        fileName: file.file_name,
        fileType: file.file_type,
        fileSize: file.file_size,
        uploadedAt: file.created_at,
        status: "processed",
      };
    } catch (error: any) {
      console.error("Text upload error:", error);
      throw new Error(`Failed to process text: ${error.message}`);
    }
  }

  async getChatbotFiles(chatbotId: string, userId: string) {
    // Verify ownership
    const [chatbot] = await db
      .select()
      .from(chatbots)
      .where(and(eq(chatbots.id, chatbotId), eq(chatbots.user_id, userId)))
      .limit(1);

    if (!chatbot) {
      throw new Error("Chatbot not found or unauthorized");
    }

    const files = await db
      .select({
        id: chatbotFiles.id,
        fileName: chatbotFiles.file_name,
        fileType: chatbotFiles.file_type,
        fileSize: chatbotFiles.file_size,
        createdAt: chatbotFiles.created_at,
      })
      .from(chatbotFiles)
      .where(eq(chatbotFiles.chatbot_id, chatbotId))
      .orderBy(chatbotFiles.created_at);

    return files;
  }

  async getFileContent(chatbotId: string, fileId: string, userId: string) {
    // Verify ownership
    const [chatbot] = await db
      .select()
      .from(chatbots)
      .where(and(eq(chatbots.id, chatbotId), eq(chatbots.user_id, userId)))
      .limit(1);

    if (!chatbot) {
      throw new Error("Chatbot not found or unauthorized");
    }

    const [file] = await db
      .select()
      .from(chatbotFiles)
      .where(
        and(
          eq(chatbotFiles.id, fileId),
          eq(chatbotFiles.chatbot_id, chatbotId),
        ),
      )
      .limit(1);

    if (!file) {
      throw new Error("File not found");
    }

    return {
      id: file.id,
      fileName: file.file_name,
      fileType: file.file_type,
      content: file.content,
      metadata: file.metadata,
    };
  }

  async deleteFile(chatbotId: string, fileId: string, userId: string) {
    // Verify ownership
    const [chatbot] = await db
      .select()
      .from(chatbots)
      .where(and(eq(chatbots.id, chatbotId), eq(chatbots.user_id, userId)))
      .limit(1);

    if (!chatbot) {
      throw new Error("Chatbot not found or unauthorized");
    }

    // Delete chunks first (handled by cascade, but being explicit)
    await this.ragService.deleteFileChunks(fileId);

    // Delete file
    const deleted = await db
      .delete(chatbotFiles)
      .where(
        and(
          eq(chatbotFiles.id, fileId),
          eq(chatbotFiles.chatbot_id, chatbotId),
        ),
      )
      .returning();

    if (!deleted[0]) {
      throw new Error("File not found");
    }

    return deleted[0];
  }
}
