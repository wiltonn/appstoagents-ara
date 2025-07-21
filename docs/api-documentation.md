# ARA System API Documentation

**Version**: 1.0.0  
**Base URL**: `https://ara-system.vercel.app/api`  
**Protocol**: HTTPS  
**Content-Type**: `application/json`

---

## 🏗️ Architecture Overview

The ARA System API is built using **tRPC v11** with TypeScript for end-to-end type safety. The API follows RESTful principles with real-time capabilities for chat functionality.

### Core Components
- **Authentication**: Clerk JWT validation with guest/authenticated flow
- **Database**: PostgreSQL with Prisma ORM and pgvector for embeddings
- **AI Integration**: OpenAI GPT-4o-mini with streaming support
- **Job Processing**: Redis-based queue for PDF generation
- **Storage**: Cloudflare R2 for reports and static assets

---

## 🔐 Authentication

### Authentication Types
1. **Guest Users**: Anonymous sessions tracked via UUID
2. **Authenticated Users**: Clerk JWT token validation

### Headers
```http
# For authenticated requests
Authorization: Bearer <clerk_jwt_token>

# For guest requests
X-Session-ID: <anonymous_session_uuid>
```

### Session Management
- Guest sessions are automatically created on first interaction
- Guest data can be converted to user account on authentication
- Session persistence maintained across browser refreshes

---

## 📋 Wizard API

Base path: `/api/trpc/wizard`

### Save Answer

**Endpoint**: `wizard.saveAnswer`  
**Method**: `MUTATION`  
**Auth**: Guest or Authenticated

Saves user responses to wizard questions with auto-session management.

**Request Schema**:
```typescript
{
  questionKey: string;        // Unique question identifier
  value: any;                // Answer value (string, number, array, object)
  stepId?: string;           // Wizard step ID (default: "step_1")
  sessionId?: string;        // Optional explicit session ID
}
```

**Response Schema**:
```typescript
{
  success: boolean;
  message: string;
  sessionId: string;         // Session UUID
  answerId: string;          // Answer record ID
}
```

**Example Request**:
```typescript
await trpc.wizard.saveAnswer.mutate({
  questionKey: "company_size",
  value: "startup",
  stepId: "step_1"
});
```

**Example Response**:
```json
{
  "success": true,
  "message": "Answer saved successfully",
  "sessionId": "session_abc123",
  "answerId": "answer_def456"
}
```

---

### Get Progress

**Endpoint**: `wizard.getProgress`  
**Method**: `QUERY`  
**Auth**: Guest or Authenticated

Retrieves current wizard progress with real-time scoring preview.

**Request Schema**:
```typescript
{
  sessionId?: string;        // Optional session ID
}
```

**Response Schema**:
```typescript
{
  sessionId: string;
  currentStep: number;       // Current wizard step (1-8)
  totalSteps: number;        // Total steps in wizard
  completedSteps: number[];  // Array of completed step numbers
  answers: Record<string, any>; // Key-value answer pairs
  partialScore: number | null;  // Current calculated score
  currentScore: {            // Detailed scoring breakdown
    totalScore: number;
    maxPossibleScore: number;
    pillarScores: Record<string, PillarScore>;
    scoringBreakdown: ScoringBreakdown;
  } | null;
  scoringPreview: {          // Real-time scoring preview
    estimatedScore: number;
    confidence: number;
    missingQuestions: string[];
    impactfulQuestions: string[];
  } | null;
  status: 'DRAFT' | 'SUBMITTED' | 'COMPLETED';
}
```

**Example Request**:
```typescript
const progress = await trpc.wizard.getProgress.useQuery({});
```

**Example Response**:
```json
{
  "sessionId": "session_abc123",
  "currentStep": 3,
  "totalSteps": 8,
  "completedSteps": [1, 2],
  "answers": {
    "company_size": "startup",
    "ai_usage_scale": 7,
    "technical_maturity": 6
  },
  "partialScore": 68,
  "currentScore": {
    "totalScore": 68,
    "maxPossibleScore": 100,
    "pillarScores": {
      "Technical Infrastructure": {
        "score": 75,
        "maxScore": 100,
        "percentage": 75,
        "level": "proficient"
      }
    }
  },
  "status": "DRAFT"
}
```

---

### Final Submit

**Endpoint**: `wizard.finalSubmit`  
**Method**: `MUTATION`  
**Auth**: Authenticated (Required)

Submits completed wizard for final scoring and report generation.

**Request Schema**:
```typescript
{
  sessionId?: string;        // Optional session ID
}
```

**Response Schema**:
```typescript
{
  success: boolean;
  sessionId: string;
  score: {                   // Final comprehensive score
    totalScore: number;
    maxPossibleScore: number;
    percentage: number;
    level: 'novice' | 'developing' | 'proficient' | 'advanced' | 'expert';
    pillarScores: Record<string, PillarScore>;
    scoringBreakdown: ScoringBreakdown;
    strengths: string[];
    weaknesses: string[];
    recommendations: Recommendation[];
  };
  pdfJobId: string | null;   // PDF generation job ID
  message: string;
}
```

**Example Request**:
```typescript
const result = await trpc.wizard.finalSubmit.mutate({});
```

---

### Calculate Score

**Endpoint**: `wizard.calculateScore`  
**Method**: `QUERY`  
**Auth**: Guest or Authenticated

Calculates real-time scoring preview based on current answers.

**Request Schema**:
```typescript
{
  answers: Record<string, any>; // Current answer set
  currentStep?: number;         // Current wizard step
}
```

**Response Schema**:
```typescript
{
  success: boolean;
  currentScore: ScoringResult;
  scoringPreview: ScoringPreview;
  configVersion: string;        // Scoring config version
}
```

---

## 💬 Chat API

Base path: `/api/trpc/chat`

### Send Message

**Endpoint**: `chat.sendMessage`  
**Method**: `MUTATION`  
**Auth**: Public

Sends message to AI assistant with context-aware responses.

**Request Schema**:
```typescript
{
  message: string;           // User message (1-1000 chars)
  sessionId: string;         // Session identifier
  context?: {                // Wizard context for AI
    currentStep: number;
    totalSteps: number;
    stepTitle: string;
    stepDescription?: string;
    currentAnswers: Record<string, any>;
    completedSteps: number[];
    pillarScores?: Record<string, number>;
    overallProgress: number;
  };
}
```

**Response Schema**:
```typescript
{
  message: {
    id: string;              // Message UUID
    sessionId: string;
    type: 'assistant';
    content: string;         // AI response
    timestamp: Date;
    metadata: {
      currentStep?: number;
      totalSteps?: number;
      stepTitle?: string;
      wizardContext?: Record<string, any>;
      model: 'gpt-4o-mini';
      tokens: {
        prompt: number;
        completion: number;
        total: number;
      };
      processingTime: number;
      streamingComplete: boolean;
    };
  };
  suggestions: Array<{       // Context-aware suggested responses
    id: string;
    text: string;
    category: 'question' | 'clarification' | 'help' | 'navigation';
    relevanceScore: number;
    wizardStepRelevant?: number[];
  }>;
}
```

**Example Request**:
```typescript
const response = await trpc.chat.sendMessage.mutate({
  message: "How does the scoring work?",
  sessionId: "session_abc123",
  context: {
    currentStep: 3,
    totalSteps: 8,
    stepTitle: "Technical Infrastructure",
    currentAnswers: { "company_size": "startup" },
    completedSteps: [1, 2],
    overallProgress: 37.5
  }
});
```

---

### Stream Message

**Endpoint**: `chat.streamMessage`  
**Method**: `MUTATION`  
**Auth**: Public

Creates streaming AI response for real-time chat experience.

**Request Schema**:
```typescript
{
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  model?: string;            // Default: 'gpt-4o-mini'
  maxTokens?: number;        // Default: 1000
  temperature?: number;      // Default: 0.7
}
```

**Response Schema**:
```typescript
{
  streamId: string;          // Stream identifier for WebSocket
}
```

---

### Get Chat History

**Endpoint**: `chat.getHistory`  
**Method**: `QUERY`  
**Auth**: Public

Retrieves paginated chat message history with vector search capabilities.

**Request Schema**:
```typescript
{
  sessionId: string;
  limit?: number;            // 1-100, default: 50
  cursor?: string;           // Pagination cursor
}
```

**Response Schema**:
```typescript
{
  messages: ChatMessage[];   // Array of chat messages
  hasMore: boolean;          // More messages available
  nextCursor: string | null; // Next page cursor
}
```

---

## 📄 Reports API

Base path: `/api/trpc/reports`

### Generate Report

**Endpoint**: `reports.generateReport`  
**Method**: `MUTATION`  
**Auth**: Public

Queues PDF report generation with customization options.

**Request Schema**:
```typescript
{
  sessionId: string;
  customizations?: {
    includeExecutiveSummary?: boolean;    // Default: true
    includeDetailedScoring?: boolean;     // Default: true
    includeRecommendations?: boolean;     // Default: true
    includeActionPlan?: boolean;          // Default: true
    includeBenchmarks?: boolean;          // Default: false
    includeAppendix?: boolean;            // Default: true
    logoUrl?: string;                     // Company logo URL
    companyName?: string;                 // Company name
    brandColor?: string;                  // Hex color (#RRGGBB)
    template?: 'standard' | 'executive' | 'technical' | 'minimal';
  };
  priority?: 'low' | 'normal' | 'high';  // Default: 'normal'
}
```

**Response Schema**:
```typescript
{
  jobId: string;             // Job queue identifier
  status: 'queued';
  message: string;
  estimatedTime: string;     // "2-5 minutes"
}
```

**Example Request**:
```typescript
const job = await trpc.reports.generateReport.mutate({
  sessionId: "session_abc123",
  customizations: {
    template: "executive",
    includeExecutiveSummary: true,
    includeDetailedScoring: false,
    companyName: "Acme Corp",
    brandColor: "#3B82F6"
  },
  priority: "high"
});
```

---

### Get Job Status

**Endpoint**: `reports.getJobStatus`  
**Method**: `QUERY`  
**Auth**: Public

Retrieves PDF generation job status and progress.

**Request Schema**:
```typescript
{
  jobId: string;             // Job identifier
}
```

**Response Schema**:
```typescript
{
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  error?: string;            // Error message if failed
  metadata?: {               // Job metadata
    progress?: number;       // 0-100
    estimatedCompletion?: Date;
    fileSize?: number;
    pageCount?: number;
  };
}
```

---

### Get Download URL

**Endpoint**: `reports.getDownloadUrl`  
**Method**: `QUERY`  
**Auth**: Public

Retrieves secure download URL for completed PDF report.

**Request Schema**:
```typescript
{
  jobId: string;             // Job identifier
}
```

**Response Schema**:
```typescript
{
  downloadUrl: string;       // Signed URL for download
  expiresAt: Date;          // URL expiration time
  filename?: string;         // Generated filename
  size?: number;            // File size in bytes
  pageCount?: number;       // Number of pages
}
```

---

## 🏥 Health & Monitoring

### Health Check

**Endpoint**: `/api/health`  
**Method**: `GET`  
**Auth**: Public

System health status and dependency checks.

**Response Schema**:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-21T10:30:00.000Z",
  "version": "1.0.0",
  "uptime": 3600,
  "dependencies": {
    "database": { "status": "connected", "latency": "12ms" },
    "redis": { "status": "connected", "latency": "3ms" },
    "openai": { "status": "operational", "latency": "180ms" },
    "storage": { "status": "operational", "latency": "45ms" }
  },
  "metrics": {
    "activeConnections": 42,
    "requestsPerMinute": 156,
    "averageResponseTime": "89ms",
    "errorRate": "0.02%"
  }
}
```

---

## 📊 Data Models

### Core Types

#### AuditSession
```typescript
interface AuditSession {
  id: string;
  userId?: string;            // Null for guest sessions
  isGuest: boolean;
  currentStep: number;
  totalSteps: number;
  responses: Record<string, any>;
  score?: number;
  status: 'DRAFT' | 'SUBMITTED' | 'COMPLETED';
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}
```

#### AuditAnswer
```typescript
interface AuditAnswer {
  id: string;
  auditSessionId: string;
  questionKey: string;
  stepId: string;
  value: any;               // JSON value
  createdAt: Date;
  updatedAt: Date;
}
```

#### ChatMessage
```typescript
interface ChatMessage {
  id: string;
  sessionId: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    currentStep?: number;
    totalSteps?: number;
    stepTitle?: string;
    wizardContext?: Record<string, any>;
    model?: string;
    tokens?: {
      prompt: number;
      completion: number;
      total: number;
    };
    embedding?: number[];    // Vector embedding
    processingTime?: number;
    streamingComplete?: boolean;
  };
}
```

#### ScoringResult
```typescript
interface ScoringResult {
  totalScore: number;
  maxPossibleScore: number;
  percentage: number;
  level: 'novice' | 'developing' | 'proficient' | 'advanced' | 'expert';
  pillarScores: Record<string, PillarScore>;
  scoringBreakdown: ScoringBreakdown;
  strengths: string[];
  weaknesses: string[];
  recommendations: Recommendation[];
}

interface PillarScore {
  score: number;
  maxScore: number;
  percentage: number;
  level: 'novice' | 'developing' | 'proficient' | 'advanced' | 'expert';
  questions: number;
  completedQuestions: number;
}
```

---

## 🔧 Error Handling

### Error Response Format
```typescript
interface TRPCError {
  code: string;              // Error code
  message: string;           // Human-readable message
  data?: {                   // Additional error data
    code: string;
    httpStatus: number;
    stack?: string;          // Stack trace (dev only)
    path: string;            // API path
    input?: any;             // Request input (sanitized)
  };
}
```

### HTTP Status Codes
- `200`: Success
- `400`: Bad Request - Invalid input data
- `401`: Unauthorized - Invalid or missing authentication
- `403`: Forbidden - Insufficient permissions
- `404`: Not Found - Resource doesn't exist
- `429`: Too Many Requests - Rate limit exceeded
- `500`: Internal Server Error - Server-side error

### Common Error Codes
- `BAD_REQUEST`: Invalid input parameters
- `UNAUTHORIZED`: Authentication required
- `FORBIDDEN`: Insufficient permissions
- `NOT_FOUND`: Resource not found
- `TIMEOUT`: Request timeout
- `INTERNAL_SERVER_ERROR`: Server error
- `PAYLOAD_TOO_LARGE`: Request too large
- `TOO_MANY_REQUESTS`: Rate limit exceeded

---

## 🚀 Rate Limiting

### Rate Limits
- **Wizard Operations**: 100 saves per hour per session
- **Chat Messages**: 20 messages per minute per session
- **PDF Generation**: 5 jobs per hour per session
- **API Calls**: 1000 requests per hour per IP

### Rate Limit Headers
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642781400
Retry-After: 3600
```

---

## 🔍 Examples

### Complete Wizard Flow

```typescript
// 1. Start wizard session (automatic on first save)
const saveResponse = await trpc.wizard.saveAnswer.mutate({
  questionKey: "company_size",
  value: "startup",
  stepId: "step_1"
});

// 2. Get progress with real-time scoring
const progress = await trpc.wizard.getProgress.useQuery({});

// 3. Continue answering questions
await trpc.wizard.saveAnswer.mutate({
  questionKey: "ai_usage_scale",
  value: 7,
  stepId: "step_2"
});

// 4. Get real-time score calculation
const scoring = await trpc.wizard.calculateScore.useQuery({
  answers: progress.answers,
  currentStep: progress.currentStep
});

// 5. Submit final audit (requires authentication)
const finalResult = await trpc.wizard.finalSubmit.mutate({});

// 6. Generate PDF report
const pdfJob = await trpc.reports.generateReport.mutate({
  sessionId: finalResult.sessionId,
  customizations: {
    template: "standard",
    companyName: "My Company"
  }
});

// 7. Check job status
const jobStatus = await trpc.reports.getJobStatus.useQuery({
  jobId: pdfJob.jobId
});

// 8. Get download URL when completed
if (jobStatus.status === 'completed') {
  const downloadInfo = await trpc.reports.getDownloadUrl.useQuery({
    jobId: pdfJob.jobId
  });
}
```

### Chat Integration

```typescript
// Send context-aware message
const chatResponse = await trpc.chat.sendMessage.mutate({
  message: "What does the technical infrastructure pillar assess?",
  sessionId: "session_abc123",
  context: {
    currentStep: 3,
    totalSteps: 8,
    stepTitle: "Technical Infrastructure",
    stepDescription: "Assess your current technical capabilities",
    currentAnswers: {
      "company_size": "startup",
      "ai_usage_scale": 7
    },
    completedSteps: [1, 2],
    overallProgress: 25
  }
});

// Use suggested responses
const suggestion = chatResponse.suggestions[0];
const followUp = await trpc.chat.sendMessage.mutate({
  message: suggestion.text,
  sessionId: "session_abc123",
  context: /* same context */
});

// Get chat history
const history = await trpc.chat.getHistory.useQuery({
  sessionId: "session_abc123",
  limit: 20
});
```

---

## 🔒 Security

### Data Protection
- All sensitive data encrypted at rest
- PII data automatically identified and protected
- Secure session management with JWT validation
- Rate limiting prevents abuse and DoS attacks

### Authentication Flow
1. **Guest Users**: Generate anonymous UUID, create session
2. **Sign Up**: Convert guest data to user account
3. **Sign In**: Merge guest session with user account
4. **JWT Validation**: All protected endpoints verify Clerk tokens

### Data Retention
- Guest sessions: 30 days of inactivity
- User data: Retained until account deletion
- Chat messages: 90 days for guest, permanent for users
- PDF reports: 30 days in cloud storage

---

*This API documentation is automatically generated from the tRPC schema and updated with each deployment.*