// WebSocket API route for real-time chat communication
// Handles WebSocket connections and message routing

import type { APIRoute } from 'astro';
import { WebSocketServer } from 'ws';
import type { Server } from 'http';
import url from 'url';
import type { WebSocketEvent, ChatMessage } from '../../types/chat';
import { messageService } from '../../lib/messageService';

// Global WebSocket server instance
let wss: WebSocketServer | null = null;

// Connection tracking
const connections = new Map<string, any>();
const sessionConnections = new Map<string, Set<any>>();

export const GET: APIRoute = async ({ request }) => {
  // For Astro, WebSocket upgrade needs to be handled differently
  // This endpoint provides WebSocket connection information
  return new Response(JSON.stringify({ 
    message: 'WebSocket endpoint available',
    url: '/api/ws',
    protocols: ['websocket']
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  });
};

// WebSocket server initialization function (to be called from server setup)
export function initializeWebSocketServer(server: Server) {
  if (wss) return wss;

  console.log('Initializing WebSocket server');
  
  wss = new WebSocketServer({ 
    server,
    path: '/api/ws',
  });

  wss.on('connection', (ws, request) => {
    const parsedUrl = url.parse(request.url || '', true);
    const sessionId = parsedUrl.query.sessionId as string;
    
    if (!sessionId) {
      ws.close(1008, 'Session ID required');
      return;
    }

    const connectionId = `${sessionId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Track connection
    connections.set(connectionId, ws);
    
    if (!sessionConnections.has(sessionId)) {
      sessionConnections.set(sessionId, new Set());
    }
    sessionConnections.get(sessionId)!.add(ws);

    console.log(`WebSocket connected: ${connectionId} for session ${sessionId}`);

    // Handle incoming messages
    ws.on('message', async (data) => {
      try {
        const event: WebSocketEvent = JSON.parse(data.toString());
        await handleWebSocketMessage(event, ws, sessionId);
      } catch (error) {
        console.error('WebSocket message error:', error);
        sendError(ws, 'INVALID_MESSAGE', 'Failed to parse message');
      }
    });

    // Handle ping/pong for connection health
    ws.on('ping', () => {
      ws.pong();
    });

    // Handle connection close
    ws.on('close', () => {
      console.log(`WebSocket disconnected: ${connectionId}`);
      connections.delete(connectionId);
      
      const sessionConns = sessionConnections.get(sessionId);
      if (sessionConns) {
        sessionConns.delete(ws);
        if (sessionConns.size === 0) {
          sessionConnections.delete(sessionId);
        }
      }
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error(`WebSocket error for ${connectionId}:`, error);
    });

    // Send welcome message
    sendEvent(ws, 'chat:connected', { 
      connectionId, 
      sessionId,
      timestamp: new Date().toISOString()
    });
  });

  return wss;
}

// Handle WebSocket messages
async function handleWebSocketMessage(
  event: WebSocketEvent, 
  ws: any, 
  sessionId: string
) {
  try {
    switch (event.type) {
      case 'chat:message':
        await handleChatMessage(event.payload, ws, sessionId);
        break;
        
      case 'chat:typing':
        broadcastToSession(sessionId, 'chat:typing', event.payload, ws);
        break;
        
      case 'chat:context_updated':
        // Store context update and potentially generate new suggestions
        broadcastToSession(sessionId, 'chat:context_updated', event.payload, ws);
        
        // Generate and send updated suggestions
        const suggestions = await generateContextualSuggestions(event.payload);
        sendEvent(ws, 'chat:suggested_responses', suggestions);
        break;
        
      default:
        console.warn(`Unknown WebSocket event type: ${event.type}`);
    }
  } catch (error) {
    console.error('Error handling WebSocket message:', error);
    sendError(ws, 'MESSAGE_PROCESSING_ERROR', 'Failed to process message');
  }
}

// Handle chat messages
async function handleChatMessage(message: ChatMessage, ws: any, sessionId: string) {
  try {
    // Broadcast user message to all connections in session
    if (message.type === 'user') {
      broadcastToSession(sessionId, 'chat:message', message);
      
      // Process with OpenAI and stream response
      await processWithOpenAI(message, sessionId);
    } else {
      // Broadcast assistant/system messages
      broadcastToSession(sessionId, 'chat:message', message);
    }
    
    // Store message in database with vector embedding
    try {
      if (message.metadata?.auditSessionId) {
        await messageService.storeMessage(message, message.metadata.auditSessionId);
      }
    } catch (error) {
      console.error('Failed to store message:', error);
    }
    
  } catch (error) {
    console.error('Error handling chat message:', error);
    sendError(ws, 'CHAT_ERROR', 'Failed to process chat message');
  }
}

// Process message with OpenAI streaming
async function processWithOpenAI(userMessage: ChatMessage, sessionId: string) {
  try {
    const response = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: userMessage.content }],
        model: 'gpt-4o-mini',
        max_tokens: 1000,
        temperature: 0.7,
        context: userMessage.metadata?.wizardContext ? {
          currentStep: userMessage.metadata.currentStep,
          totalSteps: userMessage.metadata.totalSteps,
          stepTitle: userMessage.metadata.stepTitle,
          currentAnswers: userMessage.metadata.wizardContext,
        } : null,
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
    let streamingMessageId = `assistant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
              // Final message with complete content
              const finalMessage: ChatMessage = {
                id: streamingMessageId,
                sessionId,
                type: 'assistant',
                content: fullContent,
                timestamp: new Date(),
                metadata: {
                  model: 'gpt-4o-mini',
                  streamingComplete: true,
                  processingTime: Date.now() - userMessage.timestamp.getTime(),
                },
              };
              
              broadcastToSession(sessionId, 'chat:message_complete', finalMessage);
              break;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content || '';
              
              if (content) {
                fullContent += content;
                
                // Send streaming chunk
                broadcastToSession(sessionId, 'chat:stream_chunk', {
                  id: streamingMessageId,
                  content,
                  fullContent,
                  isComplete: false,
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
    
  } catch (error) {
    console.error('Error processing with OpenAI:', error);
    
    const errorMessage: ChatMessage = {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId,
      type: 'system',
      content: 'Sorry, I encountered an error processing your message. Please try again.',
      timestamp: new Date(),
    };
    
    broadcastToSession(sessionId, 'chat:message', errorMessage);
  }
}

// Broadcast message to all connections in a session
function broadcastToSession(
  sessionId: string, 
  eventType: string, 
  payload: any, 
  excludeWs?: any
) {
  const sessionConns = sessionConnections.get(sessionId);
  if (!sessionConns) return;
  
  const event: WebSocketEvent = {
    type: eventType as any,
    payload,
    timestamp: new Date(),
    sessionId,
  };
  
  sessionConns.forEach(ws => {
    if (ws !== excludeWs && ws.readyState === 1) { // WebSocket.OPEN
      try {
        ws.send(JSON.stringify(event));
      } catch (error) {
        console.error('Error broadcasting to WebSocket:', error);
      }
    }
  });
}

// Send event to specific WebSocket
function sendEvent(ws: any, eventType: string, payload: any) {
  if (ws.readyState === 1) { // WebSocket.OPEN
    const event: WebSocketEvent = {
      type: eventType as any,
      payload,
      timestamp: new Date(),
      sessionId: '', // Will be filled by client
    };
    
    try {
      ws.send(JSON.stringify(event));
    } catch (error) {
      console.error('Error sending WebSocket event:', error);
    }
  }
}

// Send error to WebSocket
function sendError(ws: any, code: string, message: string) {
  sendEvent(ws, 'chat:error', {
    code,
    message,
    timestamp: new Date().toISOString(),
  });
}

// Generate contextual suggestions based on current wizard state
async function generateContextualSuggestions(context: any) {
  try {
    // Use message service for context-aware suggestions
    if (context?.auditSessionId) {
      return await messageService.getContextualSuggestions(
        context.auditSessionId,
        context,
        4
      );
    }
  } catch (error) {
    console.error('Error generating contextual suggestions:', error);
  }

  // Fallback to static suggestions
  const suggestions = [
    { id: '1', text: 'What does this question assess?', category: 'clarification', relevanceScore: 0.9 },
    { id: '2', text: 'How should I answer this accurately?', category: 'help', relevanceScore: 0.8 },
    { id: '3', text: 'Can I skip questions I\'m unsure about?', category: 'question', relevanceScore: 0.6 },
    { id: '4', text: 'Save and continue later', category: 'navigation', relevanceScore: 0.4 },
  ];
  
  // Add context-specific suggestions
  if (context?.currentStep) {
    suggestions.unshift({
      id: 'context-1',
      text: `Help me with step ${context.currentStep}`,
      category: 'context',
      relevanceScore: 0.95
    });
  }
  
  return suggestions.slice(0, 4); // Return top 4 suggestions
}

// Export connection management functions
export function getActiveConnections() {
  return connections.size;
}

export function getActiveSessionConnections(sessionId: string) {
  return sessionConnections.get(sessionId)?.size || 0;
}

export function closeWebSocketServer() {
  if (wss) {
    wss.close();
    wss = null;
  }
}