# API Reference

**ARA tRPC API Documentation**

Generated from TRD specifications and system design.

---

## Overview

The ARA API is built using tRPC with TypeScript for end-to-end type safety. All endpoints run on Vercel Edge Runtime for optimal performance.

**Base URL**: `https://[your-domain]/api/trpc`

---

## Authentication

### Authentication Headers

```typescript
// Authenticated requests
Authorization: Bearer <clerk-jwt-token>

// Guest requests  
X-Anonymous-ID: <uuid-v4>
```

### Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| Wizard operations | 100 requests | 1 hour |
| Chat messages | 20 requests | 1 minute |
| Report generation | 5 requests | 1 hour |

---

## Wizard API

### `wizard.saveAnswer`

Save or update a wizard answer with auto-save functionality.

**Method**: Mutation  
**Auth**: Optional (supports guest users)

```typescript
// Input
{
  questionKey: string;     // e.g., "company_size", "tech_stack"
  value: any;             // Answer value (string, number, array, object)
  stepId?: string;        // Current wizard step for context
}

// Output
{
  success: boolean;
  sessionId: string;
  updatedAt: Date;
  validationErrors?: string[];
}
```

**Example**:
```typescript
await trpc.wizard.saveAnswer.mutate({
  questionKey: "company_size",
  value: "51-200",
  stepId: "step-2"
});
```

### `wizard.getProgress`

Retrieve current wizard progress and partial scoring.

**Method**: Query  
**Auth**: Optional (supports guest users)

```typescript
// Input
{
  sessionId?: string;     // Optional, uses current session if not provided
}

// Output
{
  sessionId: string;
  currentStep: number;
  totalSteps: number;
  completedSteps: number[];
  answers: Record<string, any>;
  partialScore?: {
    total: number;
    pillars: Array<{
      name: string;
      score: number;
      maxScore: number;
    }>;
  };
  status: "DRAFT" | "SUBMITTED" | "SCORED" | "REPORT_READY";
}
```

### `wizard.finalSubmit`

Submit completed wizard for final scoring and PDF generation.

**Method**: Mutation  
**Auth**: Required (must be authenticated user)

```typescript
// Input
{
  sessionId: string;
}

// Output
{
  success: boolean;
  sessionId: string;
  finalScore: {
    total: number;
    maxTotal: number;
    pillars: Array<{
      name: string;
      score: number;
      maxScore: number;
      questions: Array<{
        key: string;
        score: number;
        weight: number;
      }>;
    }>;
    calculatedAt: Date;
  };
  pdfJobId: string;       // Track PDF generation progress
  estimatedPdfReady: Date; // Estimated completion time
}
```

---

## Chat API

### `chat.sendMessage`

Send a message to the AI assistant with streaming response.

**Method**: Mutation  
**Auth**: Optional (supports guest users)

```typescript
// Input
{
  message: string;        // User message (max 2000 characters)
  sessionId: string;      // Current audit session
  stepContext?: string;   // Current wizard step for context
}

// Output (Streaming)
{
  messageId: string;
  role: "assistant";
  content: string;        // Streaming content
  metadata?: {
    functionCall?: {
      name: string;
      arguments: any;
    };
    stepSuggestions?: {
      questionKey: string;
      suggestedValue: any;
      confidence: number;
    }[];
  };
  tokens: number;
  createdAt: Date;
}
```

### `chat.getHistory`

Retrieve chat message history for current session.

**Method**: Query  
**Auth**: Optional (supports guest users)

```typescript
// Input
{
  sessionId: string;
  limit?: number;         // Default: 50, Max: 100
  before?: string;        // Message ID for pagination
}

// Output
{
  messages: Array<{
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    metadata?: any;
    tokens: number;
    createdAt: Date;
  }>;
  hasMore: boolean;
  nextCursor?: string;
}
```

### `chat.acceptSuggestion`

Accept an AI suggestion and apply it to the wizard.

**Method**: Mutation  
**Auth**: Optional (supports guest users)

```typescript
// Input
{
  messageId: string;      // Message containing the suggestion
  suggestionIndex: number; // Which suggestion to accept
  questionKey: string;    // Target wizard field
}

// Output
{
  success: boolean;
  updatedAnswer: {
    questionKey: string;
    value: any;
    updatedAt: Date;
  };
}
```

---

## Reports API

### `reports.getReport`

Get signed URL for downloading generated PDF report.

**Method**: Query  
**Auth**: Required (owner only)

```typescript
// Input
{
  sessionId: string;
}

// Output
{
  reportUrl: string;      // Signed URL valid for 7 days
  expiresAt: Date;
  fileSize: number;       // Size in bytes
  generatedAt: Date;
}
```

### `reports.getStatus`

Check PDF generation status for a session.

**Method**: Query  
**Auth**: Required (owner only)

```typescript
// Input
{
  sessionId: string;
}

// Output
{
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  progress?: number;      // 0-100 percentage
  estimatedCompletion?: Date;
  errorMessage?: string;
  jobId: string;
}
```

### `reports.regenerate`

Request regeneration of PDF report (if needed).

**Method**: Mutation  
**Auth**: Required (owner only)

```typescript
// Input
{
  sessionId: string;
  reason?: string;        // Optional reason for regeneration
}

// Output
{
  success: boolean;
  newJobId: string;
  estimatedCompletion: Date;
}
```

---

## Session Management API

### `session.convert`

Convert guest session to authenticated user session.

**Method**: Mutation  
**Auth**: Required (new user)

```typescript
// Input
{
  anonymousId: string;    // Guest session to convert
}

// Output
{
  success: boolean;
  sessionId: string;      // Converted session ID
  mergedAnswers: number;  // Count of preserved answers
  mergedMessages: number; // Count of preserved chat messages
}
```

### `session.getMetadata`

Get session metadata and statistics.

**Method**: Query  
**Auth**: Required (owner only)

```typescript
// Input
{
  sessionId: string;
}

// Output
{
  sessionId: string;
  userId?: string;
  anonymousId?: string;
  status: "DRAFT" | "SUBMITTED" | "SCORED" | "REPORT_READY";
  startedAt: Date;
  lastActivityAt: Date;
  completedAt?: Date;
  statistics: {
    answersCount: number;
    chatMessages: number;
    timeSpent: number;     // Minutes
    stepCompletionTimes: Record<string, number>;
  };
}
```

---

## Configuration API

### `config.getScoringWeights`

Get current scoring configuration (cached).

**Method**: Query  
**Auth**: None

```typescript
// Output
{
  version: string;
  pillars: Record<string, {
    name: string;
    weight: number;
    description: string;
    questions: Record<string, {
      weight: number;
      scoringFunction: "linear" | "exponential" | "threshold";
      maxScore: number;
      description: string;
    }>;
  }>;
  lastUpdated: Date;
}
```

### `config.getWizardSteps`

Get wizard step configuration and validation rules.

**Method**: Query  
**Auth**: None

```typescript
// Output
{
  steps: Array<{
    id: string;
    title: string;
    description: string;
    order: number;
    questions: Array<{
      key: string;
      type: "text" | "select" | "multiselect" | "number" | "boolean";
      label: string;
      placeholder?: string;
      required: boolean;
      validation?: {
        min?: number;
        max?: number;
        pattern?: string;
        options?: string[];
      };
      helpText?: string;
    }>;
  }>;
}
```

---

## Error Handling

### Error Response Format

```typescript
{
  error: {
    code: string;           // Error code
    message: string;        // Human-readable message
    details?: any;          // Additional error context
    statusCode: number;     // HTTP status code
  };
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Invalid or missing authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Input validation failed |
| `RATE_LIMITED` | 429 | Rate limit exceeded |
| `INTERNAL_ERROR` | 500 | Server error |
| `SERVICE_UNAVAILABLE` | 503 | External service failure |

### Error Examples

```typescript
// Validation error
{
  error: {
    code: "VALIDATION_ERROR",
    message: "Invalid input data",
    details: {
      fieldErrors: {
        "questionKey": "Required field missing",
        "value": "Value must be a string"
      }
    },
    statusCode: 400
  }
}

// Rate limit error
{
  error: {
    code: "RATE_LIMITED",
    message: "Too many requests",
    details: {
      limit: 20,
      resetTime: "2025-07-20T15:30:00Z",
      retryAfter: 45
    },
    statusCode: 429
  }
}
```

---

## WebSocket Events (Chat)

### Connection URL
`wss://[your-domain]/api/chat/ws`

### Authentication
Send JWT token in connection query parameter:
`wss://[your-domain]/api/chat/ws?token=<clerk-jwt>`

### Message Format

```typescript
// Client → Server
{
  type: "message";
  sessionId: string;
  content: string;
  stepContext?: string;
}

// Server → Client  
{
  type: "response";
  messageId: string;
  content: string;        // Streaming
  metadata?: any;
  isComplete: boolean;
}

// Connection events
{
  type: "connected" | "disconnected" | "error";
  message?: string;
}
```

---

## Rate Limiting Details

### Rate Limit Headers

All responses include rate limiting headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642694400
X-RateLimit-Retry-After: 3600
```

### Rate Limit Strategies

- **User-based**: Authenticated users get higher limits
- **IP-based**: Fallback for guest users
- **Endpoint-specific**: Different limits per operation type
- **Sliding window**: More accurate than fixed windows

---

## SDK Usage Examples

### TypeScript Client

```typescript
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from './server/routers/_app';

const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: '/api/trpc',
      headers: () => ({
        Authorization: `Bearer ${getClerkToken()}`,
      }),
    }),
  ],
});

// Usage
const progress = await trpc.wizard.getProgress.query();
const result = await trpc.wizard.saveAnswer.mutate({
  questionKey: 'company_size',
  value: '51-200'
});
```

### React Hooks

```typescript
import { api } from '~/utils/api';

function WizardStep() {
  const progress = api.wizard.getProgress.useQuery();
  const saveAnswer = api.wizard.saveAnswer.useMutation();
  
  const handleSave = (key: string, value: any) => {
    saveAnswer.mutate({ questionKey: key, value });
  };
  
  // ...
}
```

---

*This API reference is generated from the TRD specifications and system design. For implementation details, see the [System Design document](../resources/ARA-System-Design.md).*