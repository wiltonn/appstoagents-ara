// Chat service for OpenAI integration and context management
// Handles streaming responses, context awareness, and message processing

import type { 
  ChatMessage, 
  ChatContext, 
  ChatStreamChunk, 
  OpenAIStreamResponse,
  SuggestedResponse,
  ChatConfig 
} from '../types/chat';

export class ChatService {
  private config: ChatConfig;
  private currentContext: ChatContext | null = null;

  constructor(config: ChatConfig) {
    this.config = config;
  }

  // Context management
  updateContext(context: ChatContext): void {
    this.currentContext = context;
  }

  getCurrentContext(): ChatContext | null {
    return this.currentContext;
  }

  // Message processing
  async processMessage(
    message: ChatMessage,
    onStreamChunk?: (chunk: ChatStreamChunk) => void
  ): Promise<ChatMessage> {
    try {
      const messages = [
        { role: 'user', content: message.content }
      ];

      if (this.config.openai.streamingEnabled && onStreamChunk) {
        return await this.processStreamingMessage(messages, message, onStreamChunk);
      } else {
        return await this.processNonStreamingMessage(messages, message);
      }
    } catch (error) {
      console.error('Error processing chat message:', error);
      throw error;
    }
  }

  // Streaming response processing
  private async processStreamingMessage(
    messages: any[],
    originalMessage: ChatMessage,
    onStreamChunk: (chunk: ChatStreamChunk) => void
  ): Promise<ChatMessage> {
    const response = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        model: this.config.openai.model,
        max_tokens: this.config.openai.maxTokens,
        temperature: this.config.openai.temperature,
        stream: true,
        context: this.currentContext,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body reader available');
    }

    let fullContent = '';
    let totalTokens = 0;
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              // Stream complete
              onStreamChunk({
                id: this.generateId(),
                content: '',
                isComplete: true,
                metadata: { tokens: totalTokens, model: this.config.openai.model }
              });
              break;
            }

            try {
              const parsed: OpenAIStreamResponse = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content || '';
              
              if (content) {
                fullContent += content;
                totalTokens++;

                onStreamChunk({
                  id: this.generateId(),
                  content,
                  isComplete: false,
                  metadata: { tokens: totalTokens, model: this.config.openai.model }
                });
              }
            } catch (parseError) {
              console.warn('Failed to parse streaming chunk:', parseError);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Create the final assistant message
    const assistantMessage: ChatMessage = {
      id: this.generateId(),
      sessionId: originalMessage.sessionId,
      type: 'assistant',
      content: fullContent,
      timestamp: new Date(),
      metadata: {
        currentStep: this.currentContext?.currentStep,
        totalSteps: this.currentContext?.totalSteps,
        stepTitle: this.currentContext?.stepTitle,
        wizardContext: this.currentContext?.currentAnswers,
        model: this.config.openai.model,
        tokens: {
          prompt: this.estimateTokens(messages),
          completion: totalTokens,
          total: this.estimateTokens(messages) + totalTokens
        },
        processingTime: Date.now() - originalMessage.timestamp.getTime(),
        streamingComplete: true
      }
    };

    return assistantMessage;
  }

  // Non-streaming response processing
  private async processNonStreamingMessage(
    messages: any[],
    originalMessage: ChatMessage
  ): Promise<ChatMessage> {
    const response = await fetch('/api/chat/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        model: this.config.openai.model,
        max_tokens: this.config.openai.maxTokens,
        temperature: this.config.openai.temperature,
        context: this.currentContext,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';
    const usage = data.usage || {};

    const assistantMessage: ChatMessage = {
      id: this.generateId(),
      sessionId: originalMessage.sessionId,
      type: 'assistant',
      content,
      timestamp: new Date(),
      metadata: {
        currentStep: this.currentContext?.currentStep,
        totalSteps: this.currentContext?.totalSteps,
        stepTitle: this.currentContext?.stepTitle,
        wizardContext: this.currentContext?.currentAnswers,
        model: this.config.openai.model,
        tokens: {
          prompt: usage.prompt_tokens || 0,
          completion: usage.completion_tokens || 0,
          total: usage.total_tokens || 0
        },
        processingTime: Date.now() - originalMessage.timestamp.getTime(),
        streamingComplete: false
      }
    };

    return assistantMessage;
  }

  // Suggested responses generation
  generateSuggestedResponses(): SuggestedResponse[] {
    if (!this.currentContext) {
      return this.getDefaultSuggestions();
    }

    const suggestions: SuggestedResponse[] = [];
    const step = this.currentContext.currentStep;
    const progress = this.currentContext.overallProgress;

    // Context-aware suggestions based on current wizard step
    if (step === 1) {
      suggestions.push(
        { id: '1', text: 'What information do I need to prepare?', category: 'question', relevanceScore: 0.9, wizardStepRelevant: [1] },
        { id: '2', text: 'How long will this audit take?', category: 'question', relevanceScore: 0.8, wizardStepRelevant: [1] },
        { id: '3', text: 'Can I save my progress and come back later?', category: 'question', relevanceScore: 0.7, wizardStepRelevant: [1] }
      );
    } else if (progress < 50) {
      suggestions.push(
        { id: '4', text: 'What does this question assess?', category: 'clarification', relevanceScore: 0.9 },
        { id: '5', text: 'How should I answer this accurately?', category: 'help', relevanceScore: 0.8 },
        { id: '6', text: 'Can I skip questions I\'m unsure about?', category: 'question', relevanceScore: 0.6 }
      );
    } else {
      suggestions.push(
        { id: '7', text: 'How is my score calculated?', category: 'question', relevanceScore: 0.9 },
        { id: '8', text: 'What do my current results indicate?', category: 'question', relevanceScore: 0.8 },
        { id: '9', text: 'When will I receive my report?', category: 'question', relevanceScore: 0.7 }
      );
    }

    // Add general help options
    suggestions.push(
      { id: '10', text: 'Go to previous step', category: 'navigation', relevanceScore: 0.5 },
      { id: '11', text: 'Save and continue later', category: 'navigation', relevanceScore: 0.4 },
      { id: '12', text: 'Get help with this section', category: 'help', relevanceScore: 0.6 }
    );

    return suggestions
      .filter(s => s.relevanceScore >= this.config.suggestions.relevanceThreshold)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, this.config.suggestions.maxSuggestions);
  }


  private buildAnswersContext(answers: Record<string, any>): string {
    const recentAnswers = Object.entries(answers)
      .slice(-5) // Last 5 answers for context
      .map(([key, value]) => `${key}: ${this.formatAnswerForContext(value)}`)
      .join(', ');
    
    return recentAnswers || 'No answers provided yet';
  }

  private formatAnswerForContext(value: any): string {
    if (typeof value === 'string') return value.length > 50 ? value.substring(0, 50) + '...' : value;
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (Array.isArray(value)) return `[${value.length} items]`;
    return '[Complex answer]';
  }

  private getDefaultSuggestions(): SuggestedResponse[] {
    return [
      { id: 'default1', text: 'How does this audit work?', category: 'question', relevanceScore: 0.9 },
      { id: 'default2', text: 'What will I learn from this?', category: 'question', relevanceScore: 0.8 },
      { id: 'default3', text: 'How long does it take?', category: 'question', relevanceScore: 0.7 },
      { id: 'default4', text: 'Get started with the audit', category: 'navigation', relevanceScore: 0.6 }
    ];
  }

  // Utility methods
  private generateId(): string {
    return `chat_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private estimateTokens(messages: any[]): number {
    // Rough estimation: ~4 characters per token
    const totalChars = messages.reduce((sum, msg) => sum + (msg.content?.length || 0), 0);
    return Math.ceil(totalChars / 4);
  }
}