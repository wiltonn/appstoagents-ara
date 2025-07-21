// Real-time chat interface component for Task 2.2
// Supports streaming responses, suggested chips, and context awareness

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { WebSocketClient } from '../../lib/websocket';
import { ChatService } from '../../lib/chatService';
import type { 
  ChatMessage, 
  ChatContext, 
  ChatStreamChunk, 
  SuggestedResponse,
  ChatConfig 
} from '../../types/chat';

interface ChatInterfaceProps {
  sessionId: string;
  context?: ChatContext;
  onContextUpdate?: (context: ChatContext) => void;
  className?: string;
  variant?: 'sidebar' | 'modal' | 'embedded';
  config?: Partial<ChatConfig>;
}

const defaultConfig: ChatConfig = {
  openai: {
    model: 'gpt-4o-mini',
    maxTokens: 1000,
    temperature: 0.7,
    streamingEnabled: true,
  },
  websocket: {
    reconnectAttempts: 5,
    reconnectDelay: 1000,
    heartbeatInterval: 30000,
  },
  suggestions: {
    maxSuggestions: 4,
    relevanceThreshold: 0.5,
    updateFrequency: 5000,
  },
  vectorSearch: {
    enabled: true,
    dimensions: 1536,
    similarityThreshold: 0.8,
  },
};

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  sessionId,
  context,
  onContextUpdate,
  className = '',
  variant = 'sidebar',
  config: userConfig = {},
}) => {
  // State management
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [suggestedResponses, setSuggestedResponses] = useState<SuggestedResponse[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wsClientRef = useRef<WebSocketClient | null>(null);
  const chatServiceRef = useRef<ChatService | null>(null);
  const isUserScrollingRef = useRef(false);

  // Configuration
  const config = { ...defaultConfig, ...userConfig };

  // Initialize services
  useEffect(() => {
    chatServiceRef.current = new ChatService(config);
    wsClientRef.current = new WebSocketClient(sessionId);

    return () => {
      wsClientRef.current?.disconnect();
    };
  }, [sessionId, config]);

  // WebSocket connection and event handling
  useEffect(() => {
    const wsClient = wsClientRef.current;
    if (!wsClient) return;

    const handleConnection = () => {
      setIsConnected(true);
      console.log('Chat connected');
    };

    const handleDisconnection = () => {
      setIsConnected(false);
      console.log('Chat disconnected');
    };

    const handleMessage = (message: ChatMessage) => {
      setMessages(prev => [...prev, message]);
      setIsTyping(false);
      
      // Update unread count if minimized
      if (isMinimized && message.type === 'assistant') {
        setUnreadCount(prev => prev + 1);
      }
    };

    const handleStreamChunk = (chunk: ChatStreamChunk) => {
      if (chunk.isComplete) {
        setStreamingMessageId(null);
        setIsTyping(false);
        return;
      }

      setMessages(prev => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage && lastMessage.id === streamingMessageId) {
          // Update existing streaming message
          return prev.map(msg => 
            msg.id === streamingMessageId 
              ? { ...msg, content: msg.content + chunk.content }
              : msg
          );
        } else {
          // Create new streaming message
          const newMessage: ChatMessage = {
            id: chunk.id,
            sessionId,
            type: 'assistant',
            content: chunk.content,
            timestamp: new Date(),
            metadata: chunk.metadata
          };
          setStreamingMessageId(chunk.id);
          return [...prev, newMessage];
        }
      });
    };

    const handleTyping = (data: { isTyping: boolean }) => {
      setIsTyping(data.isTyping);
    };

    const handleSuggestedResponses = (responses: SuggestedResponse[]) => {
      setSuggestedResponses(responses);
    };

    const handleError = (error: any) => {
      console.error('Chat error:', error);
      // Could add error message to chat here
    };

    // Subscribe to events
    wsClient.on('chat:connected', handleConnection);
    wsClient.on('chat:disconnected', handleDisconnection);
    wsClient.on('chat:message', handleMessage);
    wsClient.on('chat:stream_chunk', handleStreamChunk);
    wsClient.on('chat:typing', handleTyping);
    wsClient.on('chat:suggested_responses', handleSuggestedResponses);
    wsClient.on('chat:error', handleError);

    // Connect
    wsClient.connect().catch(console.error);

    return () => {
      wsClient.off('chat:connected', handleConnection);
      wsClient.off('chat:disconnected', handleDisconnection);
      wsClient.off('chat:message', handleMessage);
      wsClient.off('chat:stream_chunk', handleStreamChunk);
      wsClient.off('chat:typing', handleTyping);
      wsClient.off('chat:suggested_responses', handleSuggestedResponses);
      wsClient.off('chat:error', handleError);
    };
  }, [sessionId, streamingMessageId, isMinimized]);

  // Context updates
  useEffect(() => {
    if (context && chatServiceRef.current) {
      chatServiceRef.current.updateContext(context);
      wsClientRef.current?.updateContext(context);
      
      // Update suggested responses based on new context
      const suggestions = chatServiceRef.current.generateSuggestedResponses();
      setSuggestedResponses(suggestions);
    }
  }, [context]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (!isUserScrollingRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Message sending
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || !chatServiceRef.current || !wsClientRef.current) return;

    const userMessage: ChatMessage = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId,
      type: 'user',
      content: content.trim(),
      timestamp: new Date(),
      metadata: {
        currentStep: context?.currentStep,
        totalSteps: context?.totalSteps,
        stepTitle: context?.stepTitle,
        wizardContext: context?.currentAnswers,
      }
    };

    // Add user message immediately
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    // Send via WebSocket
    wsClientRef.current.sendMessage(userMessage);

    try {
      // Process with ChatService for AI response
      const assistantMessage = await chatServiceRef.current.processMessage(
        userMessage,
        (chunk) => {
          // Streaming is handled by WebSocket events
          wsClientRef.current?.send({
            type: 'chat:stream_chunk',
            payload: chunk,
            timestamp: new Date(),
            sessionId
          });
        }
      );

      // Send final message via WebSocket
      wsClientRef.current.sendMessage(assistantMessage);
    } catch (error) {
      console.error('Error processing message:', error);
      setIsTyping(false);
      
      // Add error message
      const errorMessage: ChatMessage = {
        id: `error_${Date.now()}`,
        sessionId,
        type: 'system',
        content: 'Sorry, I encountered an error processing your message. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  }, [sessionId, context]);

  // Event handlers
  const handleSendMessage = () => {
    sendMessage(inputValue);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSuggestedResponseClick = (response: SuggestedResponse) => {
    if (response.category === 'navigation') {
      // Handle navigation suggestions
      if (response.text.includes('previous step') && onContextUpdate && context) {
        const newContext = { ...context, currentStep: Math.max(1, context.currentStep - 1) };
        onContextUpdate(newContext);
      }
      return;
    }
    
    sendMessage(response.text);
  };

  const handleMinimize = () => {
    setIsMinimized(!isMinimized);
    if (!isMinimized) {
      setUnreadCount(0);
    }
  };

  const handleScroll = (e: React.UIEvent) => {
    const element = e.target as HTMLElement;
    const isAtBottom = element.scrollHeight - element.scrollTop === element.clientHeight;
    isUserScrollingRef.current = !isAtBottom;
  };

  // Render connection status
  const renderConnectionStatus = () => (
    <div className={`flex items-center space-x-2 text-xs ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
      <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
      <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
    </div>
  );

  // Render message
  const renderMessage = (message: ChatMessage) => {
    const isUser = message.type === 'user';
    const isSystem = message.type === 'system';
    
    return (
      <div key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
        <div className={`
          max-w-xs lg:max-w-md px-4 py-2 rounded-lg
          ${isUser 
            ? 'bg-blue-500 text-white' 
            : isSystem
            ? 'bg-gray-100 text-gray-700 border border-gray-200'
            : 'bg-gray-200 text-gray-900'
          }
        `}>
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          <p className="text-xs mt-1 opacity-70">
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    );
  };

  // Render suggested responses
  const renderSuggestedResponses = () => {
    if (suggestedResponses.length === 0) return null;

    return (
      <div className="px-4 py-2 border-t border-gray-200">
        <p className="text-xs text-gray-500 mb-2">Suggested responses:</p>
        <div className="flex flex-wrap gap-2">
          {suggestedResponses.map((response) => (
            <button
              key={response.id}
              onClick={() => handleSuggestedResponseClick(response)}
              className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
            >
              {response.text}
            </button>
          ))}
        </div>
      </div>
    );
  };

  // Main render based on variant
  const chatContent = (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.003 8.003 0 01-7.799-6.44c-.089-.463-.089-.989 0-1.452A8.003 8.003 0 0113 4c4.418 0 8 3.582 8 8z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-medium">ARA Assistant</h3>
            {context && (
              <p className="text-xs text-gray-500">
                Step {context.currentStep} of {context.totalSteps}: {context.stepTitle}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {renderConnectionStatus()}
          {variant !== 'embedded' && (
            <button
              onClick={handleMinimize}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isMinimized ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
              </svg>
            </button>
          )}
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <div 
            className="flex-1 overflow-y-auto p-4 bg-gray-50"
            onScroll={handleScroll}
          >
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 mt-8">
                <p className="text-sm">👋 Hi! I'm here to help with your Agent Readiness Audit.</p>
                <p className="text-xs mt-2">Feel free to ask me any questions!</p>
              </div>
            ) : (
              messages.map(renderMessage)
            )}
            
            {isTyping && (
              <div className="flex justify-start mb-4">
                <div className="bg-gray-200 rounded-lg px-4 py-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse"></div>
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Responses */}
          {renderSuggestedResponses()}

          {/* Input */}
          <div className="p-4 bg-white border-t border-gray-200">
            <div className="flex space-x-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything about the audit..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={!isConnected}
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || !isConnected}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Minimized state - show unread count */}
      {isMinimized && unreadCount > 0 && (
        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
          {unreadCount}
        </div>
      )}
    </div>
  );

  // Variant-specific wrapper
  if (variant === 'modal') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md h-96 max-h-screen">
          {chatContent}
        </div>
      </div>
    );
  }

  if (variant === 'sidebar') {
    return (
      <div className={`w-80 h-full bg-white border-l border-gray-200 relative ${isMinimized ? 'w-12' : ''}`}>
        {chatContent}
      </div>
    );
  }

  // Embedded variant
  return (
    <div className="w-full h-96 bg-white border border-gray-200 rounded-lg overflow-hidden">
      {chatContent}
    </div>
  );
};