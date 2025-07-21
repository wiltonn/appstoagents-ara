// Global Test Setup - Task 3.3: Testing Suite
// Global setup for all test environments

import { beforeAll, afterAll } from 'vitest';

// Global test setup
export async function setup() {
  console.log('🧪 Setting up global test environment...');
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/ara_test';
  process.env.REDIS_URL = 'redis://localhost:6379/1';
  process.env.PII_ENCRYPTION_KEY = 'test-key-32-characters-minimum-required';
  process.env.CSRF_SECRET = 'test-csrf-secret-key-for-testing';
  process.env.ADMIN_API_KEY = 'test-admin-key';
  
  // Mock global objects that may not be available in test environment
  if (typeof globalThis.crypto === 'undefined') {
    const { webcrypto } = await import('crypto');
    globalThis.crypto = webcrypto as any;
  }
  
  // Mock fetch if not available
  if (typeof globalThis.fetch === 'undefined') {
    const { default: fetch } = await import('node-fetch');
    globalThis.fetch = fetch as any;
  }
  
  // Mock WebSocket if not available
  if (typeof globalThis.WebSocket === 'undefined') {
    globalThis.WebSocket = class MockWebSocket {
      constructor() {}
      send() {}
      close() {}
      addEventListener() {}
      removeEventListener() {}
    } as any;
  }
  
  console.log('✅ Global test environment setup complete');
}

// Global test teardown
export async function teardown() {
  console.log('🧹 Cleaning up global test environment...');
  
  // Cleanup any global resources
  // Add cleanup logic here if needed
  
  console.log('✅ Global test environment cleanup complete');
}

// Export for Vitest
export default async function() {
  await setup();
}