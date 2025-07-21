// Vitest Setup File - Task 3.3: Testing Suite
// Setup for individual test files

import { beforeEach, afterEach, vi } from 'vitest';

// Setup before each test
beforeEach(() => {
  // Reset all mocks
  vi.clearAllMocks();
  
  // Reset environment variables to test defaults
  process.env.NODE_ENV = 'test';
  
  // Clear any global state
  if (globalThis.WIZARD_CONFIG) {
    delete globalThis.WIZARD_CONFIG;
  }
});

// Cleanup after each test
afterEach(() => {
  // Additional cleanup if needed
  vi.restoreAllMocks();
});

// Mock common modules that may not be available in test environment
vi.mock('@clerk/clerk-js', () => ({
  ClerkProvider: ({ children }: { children: any }) => children,
  useClerk: () => ({
    user: null,
    isSignedIn: false,
    signOut: vi.fn(),
  }),
  useUser: () => ({
    user: null,
    isSignedIn: false,
  }),
}));

// Mock Redis/IORedis for tests
vi.mock('ioredis', () => {
  const mockRedis = {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    exists: vi.fn().mockResolvedValue(0),
    expire: vi.fn().mockResolvedValue(1),
    incr: vi.fn().mockResolvedValue(1),
    eval: vi.fn().mockResolvedValue([1, 300]),
    ping: vi.fn().mockResolvedValue('PONG'),
    quit: vi.fn().mockResolvedValue('OK'),
    disconnect: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  };
  
  return {
    default: vi.fn(() => mockRedis),
    Redis: vi.fn(() => mockRedis),
  };
});

// Mock Prisma client
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => ({
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined),
    $transaction: vi.fn().mockImplementation((fn) => fn({})),
    auditSession: {
      create: vi.fn().mockResolvedValue({ id: 'test-session' }),
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({ id: 'test-session' }),
      delete: vi.fn().mockResolvedValue({ id: 'test-session' }),
    },
    auditAnswer: {
      create: vi.fn().mockResolvedValue({ id: 'test-answer' }),
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue({ id: 'test-answer' }),
    },
    chatMessage: {
      create: vi.fn().mockResolvedValue({ id: 'test-message' }),
      findMany: vi.fn().mockResolvedValue([]),
    },
  })),
}));

// Mock OpenAI
vi.mock('openai', () => ({
  default: vi.fn(() => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{
            message: {
              content: 'Mock AI response',
            },
          }],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 20,
            total_tokens: 30,
          },
        }),
      },
    },
  })),
}));

// Mock AWS SDK
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(() => ({
    send: vi.fn().mockResolvedValue({}),
  })),
  PutObjectCommand: vi.fn(),
  GetObjectCommand: vi.fn(),
  DeleteObjectCommand: vi.fn(),
}));

// Mock Bull (job queue)
vi.mock('bull', () => ({
  default: vi.fn(() => ({
    add: vi.fn().mockResolvedValue({}),
    process: vi.fn(),
    on: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Mock WebSocket for chat tests
global.WebSocket = vi.fn(() => ({
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  readyState: 1, // WebSocket.OPEN
})) as any;

// Mock fetch for API tests
global.fetch = vi.fn();

// Console helpers for tests
global.console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};