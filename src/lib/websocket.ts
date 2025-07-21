// WebSocket client for real-time chat communication
// Implements auto-reconnection, heartbeat, and message queuing

import type { 
  WebSocketEvent, 
  WebSocketEventType, 
  ChatMessage, 
  ChatContext,
  ChatError 
} from '../types/chat';

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private messageQueue: WebSocketEvent[] = [];
  private eventListeners = new Map<WebSocketEventType, Set<Function>>();
  private isConnecting = false;
  private sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  // Connection management
  connect(): Promise<void> {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return Promise.resolve();
    }

    this.isConnecting = true;
    
    return new Promise((resolve, reject) => {
      try {
        // Use appropriate WebSocket URL based on environment
        const wsUrl = this.getWebSocketUrl();
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.processMessageQueue();
          this.emit('chat:connected', { sessionId: this.sessionId });
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket disconnected:', event.code, event.reason);
          this.isConnecting = false;
          this.stopHeartbeat();
          this.emit('chat:disconnected', { 
            code: event.code, 
            reason: event.reason,
            sessionId: this.sessionId 
          });
          
          // Auto-reconnect if not a clean close
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.isConnecting = false;
          this.emit('chat:error', {
            code: 'WEBSOCKET_ERROR',
            message: 'WebSocket connection error',
            details: error
          });
          reject(error);
        };

      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  disconnect(): void {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }

  // Message sending
  sendMessage(message: ChatMessage): void {
    const event: WebSocketEvent = {
      type: 'chat:message',
      payload: message,
      timestamp: new Date(),
      sessionId: this.sessionId
    };

    this.send(event);
  }

  updateContext(context: ChatContext): void {
    const event: WebSocketEvent = {
      type: 'chat:context_updated',
      payload: context,
      timestamp: new Date(),
      sessionId: this.sessionId
    };

    this.send(event);
  }

  sendTyping(isTyping: boolean): void {
    const event: WebSocketEvent = {
      type: 'chat:typing',
      payload: { isTyping, userId: this.sessionId },
      timestamp: new Date(),
      sessionId: this.sessionId
    };

    this.send(event);
  }

  public send(event: WebSocketEvent): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(event));
      } catch (error) {
        console.error('Failed to send WebSocket message:', error);
        this.queueMessage(event);
      }
    } else {
      this.queueMessage(event);
      
      // Attempt to connect if not connected
      if (!this.isConnecting) {
        this.connect().catch(console.error);
      }
    }
  }

  // Event handling
  on(eventType: WebSocketEventType, callback: Function): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    this.eventListeners.get(eventType)!.add(callback);
  }

  off(eventType: WebSocketEventType, callback: Function): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  private emit(eventType: WebSocketEventType, payload: any): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(payload);
        } catch (error) {
          console.error(`Error in WebSocket event callback for ${eventType}:`, error);
        }
      });
    }
  }

  // Message handling
  private handleMessage(data: WebSocketEvent): void {
    switch (data.type) {
      case 'chat:message':
        this.emit('chat:message', data.payload);
        break;
      
      case 'chat:stream_chunk':
        this.emit('chat:stream_chunk', data.payload);
        break;
      
      case 'chat:stream_complete':
        this.emit('chat:stream_complete', data.payload);
        break;
      
      case 'chat:suggested_responses':
        this.emit('chat:suggested_responses', data.payload);
        break;
      
      case 'chat:error':
        this.emit('chat:error', data.payload);
        break;
      
      case 'chat:typing':
        this.emit('chat:typing', data.payload);
        break;
      
      default:
        console.warn('Unknown WebSocket message type:', data.type);
    }
  }

  // Connection utilities
  private getWebSocketUrl(): string {
    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      return `${protocol}//${host}/api/ws?sessionId=${encodeURIComponent(this.sessionId)}`;
    }
    
    // Fallback for server-side rendering
    return `ws://localhost:3000/api/ws?sessionId=${encodeURIComponent(this.sessionId)}`;
  }

  private scheduleReconnect(): void {
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    
    setTimeout(() => {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      this.connect().catch(console.error);
    }, delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'ping',
          timestamp: new Date(),
          sessionId: this.sessionId
        }));
      }
    }, 30000); // Send ping every 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private queueMessage(event: WebSocketEvent): void {
    this.messageQueue.push(event);
    
    // Limit queue size to prevent memory issues
    if (this.messageQueue.length > 100) {
      this.messageQueue.shift();
    }
  }

  private processMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const event = this.messageQueue.shift();
      if (event) {
        this.send(event);
      }
    }
  }

  // Connection status
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get connectionState(): string {
    if (!this.ws) return 'disconnected';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'connecting';
      case WebSocket.OPEN: return 'connected';
      case WebSocket.CLOSING: return 'closing';
      case WebSocket.CLOSED: return 'disconnected';
      default: return 'unknown';
    }
  }
}