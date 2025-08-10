import { openai } from '@ai-sdk/openai';
import { embed, embedMany } from 'ai';
import { db, fileChunks, chatbotFiles } from '../../db';
import { eq, sql } from 'drizzle-orm';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { encoding_for_model } from 'tiktoken';

export class RAGService {
  private textSplitter: RecursiveCharacterTextSplitter;
  private encoder: any;

  constructor() {
    // Initialize text splitter with optimal chunk size for embeddings
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000, // ~250 tokens
      chunkOverlap: 200, // 20% overlap for context continuity
      separators: ['\n\n', '\n', '.', '!', '?', ',', ' ', '']
    });
    
    // Initialize token counter
    this.encoder = encoding_for_model('gpt-3.5-turbo');
  }

  /**
   * Extract text content from various file types
   */
  async extractContent(buffer: Buffer, mimeType: string): Promise<string> {
    try {
      switch (mimeType) {
        case 'application/pdf':
          return await this.extractPDF(buffer);
        
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        case 'application/msword':
          return await this.extractWord(buffer);
        
        case 'text/plain':
        case 'text/markdown':
        case 'text/csv':
        case 'application/json':
          return buffer.toString('utf-8');
        
        default:
          throw new Error(`Unsupported file type: ${mimeType}`);
      }
    } catch (error: any) {
      console.error('Content extraction error:', error);
      throw new Error(`Failed to extract content: ${error.message}`);
    }
  }

  /**
   * Extract text from PDF files
   */
  private async extractPDF(buffer: Buffer): Promise<string> {
    try {
      const data = await pdfParse(buffer);
      return data.text;
    } catch (error) {
      console.error('PDF extraction error:', error);
      throw new Error('Failed to extract PDF content');
    }
  }

  /**
   * Extract text from Word documents
   */
  private async extractWord(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      console.error('Word extraction error:', error);
      throw new Error('Failed to extract Word document content');
    }
  }

  /**
   * Process and chunk file content for embedding
   */
  async processFileContent(
    fileId: string,
    chatbotId: string,
    content: string,
    metadata: any = {}
  ): Promise<void> {
    try {
      // Split content into chunks
      const chunks = await this.textSplitter.splitText(content);
      
      if (chunks.length === 0) {
        throw new Error('No content to process');
      }

      // Generate embeddings for all chunks
      const embeddings = await this.generateEmbeddings(chunks);

      // Prepare chunk records for database
      const chunkRecords = chunks.map((chunk, index) => ({
        file_id: fileId,
        chatbot_id: chatbotId,
        chunk_index: index,
        content: chunk,
        embedding: embeddings[index],
        token_count: this.countTokens(chunk),
        metadata: {
          ...metadata,
          chunkIndex: index,
          totalChunks: chunks.length
        }
      }));

      // Store chunks in database
      await db.insert(fileChunks).values(chunkRecords);
      
      console.log(`Processed ${chunks.length} chunks for file ${fileId}`);
    } catch (error) {
      console.error('File processing error:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings for text chunks
   */
  private async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      const model = openai.embedding('text-embedding-3-small');
      const { embeddings } = await embedMany({
        model,
        values: texts
      });
      return embeddings;
    } catch (error) {
      console.error('Embedding generation error:', error);
      throw new Error('Failed to generate embeddings');
    }
  }

  /**
   * Count tokens in text
   */
  private countTokens(text: string): number {
    try {
      const tokens = this.encoder.encode(text);
      return tokens.length;
    } catch (error) {
      // Fallback to approximate count
      return Math.ceil(text.length / 4);
    }
  }

  /**
   * Perform semantic search to find relevant chunks
   */
  async searchRelevantChunks(
    chatbotId: string,
    query: string,
    topK: number = 5
  ): Promise<any[]> {
    try {
      // Generate embedding for the query
      const model = openai.embedding('text-embedding-3-small');
      const { embedding } = await embed({
        model,
        value: query
      });

      // Perform cosine similarity search in PostgreSQL
      // Using pgvector's <-> operator for L2 distance (smaller is more similar)
      const relevantChunks = await db
        .select({
          id: fileChunks.id,
          content: fileChunks.content,
          file_id: fileChunks.file_id,
          chunk_index: fileChunks.chunk_index,
          metadata: fileChunks.metadata,
          file_name: chatbotFiles.file_name,
          // Calculate similarity score (1 - normalized distance)
          similarity: sql<number>`1 - (${fileChunks.embedding} <-> ${JSON.stringify(embedding)}::vector) / 2`
        })
        .from(fileChunks)
        .innerJoin(chatbotFiles, eq(fileChunks.file_id, chatbotFiles.id))
        .where(eq(fileChunks.chatbot_id, chatbotId))
        .orderBy(sql`${fileChunks.embedding} <-> ${JSON.stringify(embedding)}::vector`)
        .limit(topK);

      return relevantChunks;
    } catch (error) {
      console.error('Semantic search error:', error);
      throw new Error('Failed to search relevant content');
    }
  }

  /**
   * Build context from relevant chunks for the AI
   */
  buildContext(chunks: any[]): string {
    if (chunks.length === 0) {
      return '';
    }

    const context = chunks
      .map((chunk, _index) => {
        return `[Source: ${chunk.file_name} - Part ${chunk.chunk_index + 1}]\n${chunk.content}`;
      })
      .join('\n\n---\n\n');

    return `Based on the following context from uploaded documents:\n\n${context}\n\n`;
  }

  /**
   * Delete all chunks for a file
   */
  async deleteFileChunks(fileId: string): Promise<void> {
    await db.delete(fileChunks).where(eq(fileChunks.file_id, fileId));
  }
}
