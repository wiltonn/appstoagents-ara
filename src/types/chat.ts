// Chat system types for Task 2.2: Chat Integration
// Supports WebSocket-based real-time communication with OpenAI GPT-4o-mini

export interface ChatMessage {
  id: string;
  sessionId: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    // Current wizard step when message was sent
    currentStep?: number;
    totalSteps?: number;
    stepTitle?: string;
    // User answers at time of message (for context)
    wizardContext?: Record<string, any>;
    // OpenAI response metadata
    model?: string;
    tokens?: {
      prompt: number;
      completion: number;
      total: number;
    };
    // Vector embedding for semantic search
    embedding?: number[];
    // Message processing info
    processingTime?: number;
    streamingComplete?: boolean;
  };
}

export interface ChatSession {
  id: string;
  userId?: string; // Optional for guest users
  auditSessionId?: string; // Link to wizard session
  startedAt: Date;
  lastMessageAt: Date;
  isActive: boolean;
  metadata?: {
    userAgent?: string;
    ipAddress?: string;
    wizardProgress?: number; // 0-100%
  };
}

export interface WebSocketMessage {
  type: 'message' | 'typing' | 'error' | 'connection' | 'context_update';
  data: any;
  timestamp: Date;
  messageId?: string;
}

export interface ChatStreamChunk {
  id: string;
  content: string;
  isComplete: boolean;
  metadata?: {
    tokens?: number;
    model?: string;
  };
}

export interface SuggestedResponse {
  id: string;
  text: string;
  category: 'question' | 'clarification' | 'help' | 'navigation';
  relevanceScore: number;
  wizardStepRelevant?: number[];
}

export interface ChatContext {
  currentStep: number;
  totalSteps: number;
  stepTitle: string;
  stepDescription?: string;
  currentAnswers: Record<string, any>;
  completedSteps: number[];
  pillarScores?: Record<string, number>;
  overallProgress: number; // 0-100%
}

export interface OpenAIStreamResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      content?: string;
      role?: string;
    };
    finish_reason?: string;
  }>;
}

export interface ChatError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
}

// WebSocket event types
export type WebSocketEventType = 
  | 'chat:message'
  | 'chat:typing'
  | 'chat:error'
  | 'chat:connected'
  | 'chat:disconnected'
  | 'chat:context_updated'
  | 'chat:suggested_responses'
  | 'chat:stream_chunk'
  | 'chat:stream_complete';

export interface WebSocketEvent {
  type: WebSocketEventType;
  payload: any;
  timestamp: Date;
  sessionId: string;
}

// Chat service configuration
export interface ChatConfig {
  openai: {
    model: string;
    maxTokens: number;
    temperature: number;
    streamingEnabled: boolean;
  };
  websocket: {
    reconnectAttempts: number;
    reconnectDelay: number;
    heartbeatInterval: number;
  };
  suggestions: {
    maxSuggestions: number;
    relevanceThreshold: number;
    updateFrequency: number;
  };
  vectorSearch: {
    enabled: boolean;
    dimensions: number;
    similarityThreshold: number;
  };
}