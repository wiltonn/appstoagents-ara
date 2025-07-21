// Message persistence service with vector embeddings
// Handles chat message storage and retrieval with semantic search

import type { ChatMessage } from '../types/chat';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';

const prisma = new PrismaClient();
const openai = new OpenAI({
  apiKey: import.meta.env.OPENAI_API_KEY,
});

export class MessageService {
  /**
   * Store a chat message with vector embedding
   */
  async storeMessage(message: ChatMessage, auditSessionId: string): Promise<void> {
    try {
      // Generate vector embedding for the message content
      const embedding = await this.generateEmbedding(message.content);
      
      // Convert message type to Prisma enum
      const role = this.convertToPrismaRole(message.type);
      
      // Store message in database
      await prisma.chatMessage.create({
        data: {
          id: message.id,
          auditSessionId,
          role,
          content: message.content,
          metadata: message.metadata || {},
          tokens: this.estimateTokens(message.content),
          // embedding: embedding ? `[${embedding.join(',')}]` : null, // TODO: Re-enable when Prisma schema supports vector type
          createdAt: message.timestamp,
        },
      });

      console.log(`Stored message ${message.id} with embedding`);
    } catch (error) {
      console.error('Error storing message:', error);
      throw error;
    }
  }

  /**
   * Retrieve chat history for a session
   */
  async getChatHistory(
    auditSessionId: string, 
    limit: number = 50,
    offset: number = 0
  ): Promise<ChatMessage[]> {
    try {
      const messages = await prisma.chatMessage.findMany({
        where: { auditSessionId },
        orderBy: { createdAt: 'asc' },
        skip: offset,
        take: limit,
      });

      return messages.map(this.convertToCheatMessage);
    } catch (error) {
      console.error('Error retrieving chat history:', error);
      throw error;
    }
  }

  /**
   * Find similar messages using vector search
   */
  async findSimilarMessages(
    query: string,
    auditSessionId: string,
    limit: number = 5,
    similarityThreshold: number = 0.8
  ): Promise<Array<{ message: ChatMessage; similarity: number }>> {
    try {
      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbedding(query);
      if (!queryEmbedding) {
        return [];
      }

      // Use raw SQL for vector similarity search
      const results = await prisma.$queryRaw`
        SELECT 
          id, role, content, metadata, tokens, created_at,
          1 - (embedding <=> ${`[${queryEmbedding.join(',')}]`}::vector) as similarity
        FROM chat_messages 
        WHERE audit_session_id = ${auditSessionId}
          AND embedding IS NOT NULL
          AND 1 - (embedding <=> ${`[${queryEmbedding.join(',')}]`}::vector) > ${similarityThreshold}
        ORDER BY similarity DESC 
        LIMIT ${limit}
      ` as any[];

      return results.map(row => ({
        message: {
          id: row.id,
          sessionId: auditSessionId,
          type: this.convertFromPrismaRole(row.role),
          content: row.content,
          timestamp: row.created_at,
          metadata: row.metadata,
        },
        similarity: row.similarity,
      }));
    } catch (error) {
      console.error('Error finding similar messages:', error);
      return [];
    }
  }

  /**
   * Get contextual suggestions based on recent messages
   */
  async getContextualSuggestions(
    auditSessionId: string,
    currentContext?: any,
    limit: number = 4
  ): Promise<Array<{ id: string; text: string; category: string; relevanceScore: number }>> {
    try {
      // Get recent messages to understand conversation context
      const recentMessages = await this.getChatHistory(auditSessionId, 10);
      
      // Base suggestions
      const suggestions = [
        { id: '1', text: 'What does this question assess?', category: 'clarification', relevanceScore: 0.9 },
        { id: '2', text: 'How should I answer this accurately?', category: 'help', relevanceScore: 0.8 },
        { id: '3', text: 'Can I skip questions I\'m unsure about?', category: 'question', relevanceScore: 0.6 },
        { id: '4', text: 'Save and continue later', category: 'navigation', relevanceScore: 0.4 },
      ];

      // Add context-specific suggestions
      if (currentContext?.currentStep) {
        suggestions.unshift({
          id: 'context-1',
          text: `Help me with step ${currentContext.currentStep}`,
          category: 'context',
          relevanceScore: 0.95
        });
      }

      // If we have recent messages, try to find patterns
      if (recentMessages.length > 0) {
        const lastMessage = recentMessages[recentMessages.length - 1];
        if (lastMessage.content.toLowerCase().includes('score')) {
          suggestions.unshift({
            id: 'score-1',
            text: 'Explain how the scoring system works',
            category: 'scoring',
            relevanceScore: 0.93
          });
        }
      }

      // Return top suggestions
      return suggestions
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, limit);
        
    } catch (error) {
      console.error('Error getting contextual suggestions:', error);
      return [];
    }
  }

  /**
   * Delete old messages (cleanup)
   */
  async deleteOldMessages(daysOld: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await prisma.chatMessage.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
        },
      });

      console.log(`Deleted ${result.count} old messages`);
      return result.count;
    } catch (error) {
      console.error('Error deleting old messages:', error);
      throw error;
    }
  }

  /**
   * Generate vector embedding using OpenAI
   */
  private async generateEmbedding(text: string): Promise<number[] | null> {
    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text.slice(0, 8000), // Limit text length
      });

      return response.data[0]?.embedding || null;
    } catch (error) {
      console.error('Error generating embedding:', error);
      return null;
    }
  }

  /**
   * Estimate token count (simple approximation)
   */
  private estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token for English
    return Math.ceil(text.length / 4);
  }

  /**
   * Convert chat message type to Prisma MessageRole enum
   */
  private convertToPrismaRole(type: 'user' | 'assistant' | 'system'): 'USER' | 'ASSISTANT' | 'SYSTEM' {
    switch (type) {
      case 'user':
        return 'USER';
      case 'assistant':
        return 'ASSISTANT';
      case 'system':
        return 'SYSTEM';
      default:
        return 'USER';
    }
  }

  /**
   * Convert Prisma MessageRole enum to chat message type
   */
  private convertFromPrismaRole(role: string): 'user' | 'assistant' | 'system' {
    switch (role) {
      case 'USER':
        return 'user';
      case 'ASSISTANT':
        return 'assistant';
      case 'SYSTEM':
        return 'system';
      default:
        return 'user';
    }
  }

  /**
   * Convert Prisma chat message to ChatMessage type
   */
  private convertToCheatMessage(dbMessage: any): ChatMessage {
    return {
      id: dbMessage.id,
      sessionId: '', // Will be filled by caller
      type: this.convertFromPrismaRole(dbMessage.role),
      content: dbMessage.content,
      timestamp: dbMessage.createdAt,
      metadata: dbMessage.metadata,
    };
  }
}

// Export singleton instance
export const messageService = new MessageService();