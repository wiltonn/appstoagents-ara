# Architecture Decision Records (ADRs)

**Key architectural decisions for the Agent Readiness Audit application**

---

## ADR Index

| ID | Title | Status | Date |
|----|-------|--------|------|
| [ADR-001](#adr-001-frontend-framework-selection) | Frontend Framework Selection | Accepted | 2025-07-20 |
| [ADR-002](#adr-002-authentication-service-selection) | Authentication Service Selection | Accepted | 2025-07-20 |
| [ADR-003](#adr-003-database-and-vector-storage) | Database and Vector Storage | Accepted | 2025-07-20 |
| [ADR-004](#adr-004-api-design-pattern) | API Design Pattern | Accepted | 2025-07-20 |
| [ADR-005](#adr-005-state-management-strategy) | State Management Strategy | Accepted | 2025-07-20 |
| [ADR-006](#adr-006-ai-integration-architecture) | AI Integration Architecture | Accepted | 2025-07-20 |
| [ADR-007](#adr-007-file-storage-solution) | File Storage Solution | Accepted | 2025-07-20 |
| [ADR-008](#adr-008-deployment-platform) | Deployment Platform | Accepted | 2025-07-20 |

---

## ADR-001: Frontend Framework Selection

**Status**: Accepted  
**Date**: 2025-07-20  
**Deciders**: Engineering Team

### Context

Need to select a frontend framework for building a wizard-based UI with embedded chat functionality. Requirements include:
- Static site generation for performance
- Interactive islands for dynamic functionality
- SEO optimization
- Mobile responsiveness
- Accessibility compliance (WCAG 2.2 AA)

### Decision

**Selected**: Astro v4 with React 18 islands

**Alternatives Considered**:
- Next.js 14 (full React framework)
- SvelteKit (Svelte-based framework)
- Nuxt 3 (Vue-based framework)

### Rationale

**Astro Advantages**:
- **Performance**: Ships minimal JavaScript, only hydrates interactive components
- **SEO**: Excellent static site generation with SSR capabilities
- **Flexibility**: Use React for complex interactions, static HTML for simple content
- **Learning Curve**: Team familiar with React ecosystem
- **Bundle Size**: Significantly smaller JavaScript bundles

**React Islands Benefits**:
- **Selective Hydration**: Only wizard and chat components need interactivity
- **Component Reusability**: Existing React component library compatibility
- **Ecosystem**: Rich ecosystem for UI components and libraries

### Implementation

```typescript
// astro.config.mjs
export default defineConfig({
  integrations: [
    react(), 
    tailwind(),
    node({
      mode: 'middleware'
    })
  ],
  output: 'hybrid',
  adapter: vercel({
    edgeMiddleware: true
  })
});
```

**Island Architecture**:
- `WizardIsland.tsx` - Main wizard functionality
- `ChatIsland.tsx` - Embedded chat drawer
- Static Astro components for layout and content

### Consequences

**Positive**:
- Excellent performance with minimal JavaScript
- SEO-friendly with server-side rendering
- Flexible architecture for future enhancements
- Reduced complexity compared to full SPA

**Negative**:
- Less mature ecosystem compared to Next.js
- Some learning curve for Astro-specific patterns
- Limited server-side rendering for dynamic content

---

## ADR-002: Authentication Service Selection

**Status**: Accepted  
**Date**: 2025-07-20  
**Deciders**: Engineering Team, Security Team

### Context

Authentication system must support:
- Guest (anonymous) user sessions
- Seamless conversion from guest to authenticated user
- JWT-based API authentication
- OAuth providers (Google, GitHub)
- Session management and security

### Decision

**Selected**: Clerk

**Alternatives Considered**:
- NextAuth.js (open source)
- Auth0 (enterprise solution)
- Custom authentication system
- Supabase Auth

### Rationale

**Clerk Advantages**:
- **Guest User Support**: Native anonymous session handling
- **Session Migration**: Built-in guest-to-user conversion
- **JWT Integration**: Seamless JWT token management for API calls
- **Edge Runtime**: Compatible with Vercel Edge functions
- **Developer Experience**: Excellent TypeScript support and documentation

**Key Features**:
- Pre-built UI components with customization
- Comprehensive session management
- Rate limiting and security features
- Webhooks for user lifecycle events

### Implementation

```typescript
// middleware.ts
import { clerkMiddleware } from '@clerk/nextjs/server';

export default clerkMiddleware((auth, req) => {
  // Protect API routes
  if (req.nextUrl.pathname.startsWith('/api/trpc')) {
    const { userId } = auth();
    if (!userId && req.method !== 'GET') {
      return new Response('Unauthorized', { status: 401 });
    }
  }
});

// Guest session handling
const anonymousId = localStorage.getItem('ara_anonymous_id') || generateUUID();
```

### Consequences

**Positive**:
- Robust authentication with minimal implementation effort
- Excellent security and compliance features
- Seamless guest user experience
- Scalable session management

**Negative**:
- Vendor lock-in with Clerk
- Monthly cost based on active users
- Limited customization of authentication flows

---

## ADR-003: Database and Vector Storage

**Status**: Accepted  
**Date**: 2025-07-20  
**Deciders**: Engineering Team, Data Team

### Context

Database requirements:
- Relational data for users, sessions, answers
- Vector embeddings for chat message similarity search
- Full-text search capabilities
- ACID compliance for data integrity
- Scalable to 1000+ concurrent users

### Decision

**Selected**: PostgreSQL 15+ with pgvector extension

**Alternatives Considered**:
- MongoDB with Atlas Vector Search
- Supabase (managed Postgres with vector support)
- Separate vector database (Pinecone, Weaviate)
- SQLite with vector extensions

### Rationale

**PostgreSQL + pgvector Advantages**:
- **Single Database**: Relational and vector data in one system
- **ACID Compliance**: Strong consistency guarantees
- **Performance**: Native vector operations with efficient indexing
- **Ecosystem**: Mature tooling and monitoring
- **Cost Effective**: No separate vector database costs

**pgvector Benefits**:
- Native vector similarity search
- Efficient HNSW and IVFFlat indexing
- Integration with Prisma ORM
- Support for embeddings up to 2000 dimensions

### Implementation

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Vector similarity search
CREATE INDEX ON chat_messages 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- Similarity query
SELECT content, 1 - (embedding <=> query_vector) AS similarity
FROM chat_messages 
WHERE 1 - (embedding <=> query_vector) > 0.8
ORDER BY embedding <=> query_vector
LIMIT 5;
```

```typescript
// Prisma schema
model ChatMessage {
  id        String  @id @default(uuid())
  content   String
  embedding Unsupported("vector(1536)")?
  
  @@index([embedding], type: Ivfflat)
}
```

### Consequences

**Positive**:
- Simplified architecture with single database
- Excellent performance for both relational and vector queries
- Strong data consistency and reliability
- Cost-effective scaling

**Negative**:
- Learning curve for vector operations
- Limited vector indexing options compared to specialized databases
- PostgreSQL expertise required for optimization

---

## ADR-004: API Design Pattern

**Status**: Accepted  
**Date**: 2025-07-20  
**Deciders**: Engineering Team

### Context

API design requirements:
- Type-safe client-server communication
- Real-time streaming for chat functionality
- Edge runtime compatibility
- Automatic serialization/deserialization
- Developer-friendly error handling

### Decision

**Selected**: tRPC with Vercel Edge Runtime

**Alternatives Considered**:
- REST API with OpenAPI/Swagger
- GraphQL with Apollo Server
- gRPC for high-performance communication
- Custom RPC implementation

### Rationale

**tRPC Advantages**:
- **End-to-End Type Safety**: Shared types between client and server
- **No Code Generation**: Types inferred automatically
- **Edge Runtime**: Compatible with Vercel Edge functions
- **React Integration**: Excellent React Query integration
- **Developer Experience**: Autocomplete and compile-time error checking

**Key Features**:
- Automatic request/response validation with Zod
- Built-in error handling with custom error types
- Streaming support for real-time features
- Middleware support for authentication and rate limiting

### Implementation

```typescript
// Router definition
export const appRouter = router({
  wizard: router({
    saveAnswer: protectedProcedure
      .input(z.object({
        questionKey: z.string(),
        value: z.any()
      }))
      .mutation(async ({ input, ctx }) => {
        // Implementation
      })
  })
});

// Client usage
const result = await trpc.wizard.saveAnswer.mutate({
  questionKey: 'company_size',
  value: '51-200'
});
```

### Consequences

**Positive**:
- Excellent developer experience with full type safety
- Reduced API documentation overhead
- Automatic client code generation
- Built-in validation and error handling

**Negative**:
- Vendor lock-in with tRPC ecosystem
- Limited non-TypeScript client support
- Learning curve for team unfamiliar with tRPC

---

## ADR-005: State Management Strategy

**Status**: Accepted  
**Date**: 2025-07-20  
**Deciders**: Frontend Team

### Context

State management requirements:
- Wizard progress tracking across steps
- Chat message history and real-time updates
- Offline persistence with localStorage
- Optimistic updates for better UX
- Session state for guest/authenticated users

### Decision

**Selected**: Zustand + TanStack Query + localStorage

**Alternatives Considered**:
- Redux Toolkit with RTK Query
- Jotai (atomic state management)
- SWR with React Context
- React Query with React Context

### Rationale

**Zustand Advantages**:
- **Simplicity**: Minimal boilerplate compared to Redux
- **TypeScript**: Excellent TypeScript support
- **Persistence**: Built-in localStorage integration
- **Performance**: Selective subscriptions, no unnecessary re-renders
- **Bundle Size**: Significantly smaller than Redux

**TanStack Query Benefits**:
- **Server State**: Excellent server state management
- **Caching**: Intelligent caching with stale-while-revalidate
- **Optimistic Updates**: Built-in optimistic update patterns
- **Error Handling**: Comprehensive error and retry mechanisms

### Implementation

```typescript
// Wizard store
interface WizardState {
  currentStep: number;
  answers: Record<string, any>;
  setAnswer: (key: string, value: any) => void;
  nextStep: () => void;
}

const useWizardStore = create<WizardState>()(
  persist(
    (set) => ({
      currentStep: 1,
      answers: {},
      setAnswer: (key, value) => 
        set((state) => ({
          answers: { ...state.answers, [key]: value }
        })),
      nextStep: () => 
        set((state) => ({ currentStep: state.currentStep + 1 }))
    }),
    {
      name: 'wizard-storage',
      storage: createJSONStorage(() => localStorage)
    }
  )
);

// Query integration
const saveAnswer = api.wizard.saveAnswer.useMutation({
  onMutate: async (newAnswer) => {
    // Optimistic update
    useWizardStore.getState().setAnswer(newAnswer.key, newAnswer.value);
  },
  onError: (err, newAnswer, context) => {
    // Rollback on error
    useWizardStore.getState().setAnswer(newAnswer.key, context?.previousValue);
  }
});
```

### Consequences

**Positive**:
- Simple and performant state management
- Excellent developer experience
- Built-in persistence and optimistic updates
- Small bundle size impact

**Negative**:
- Multiple state management libraries to learn
- Potential complexity in state synchronization
- Limited time-travel debugging compared to Redux

---

## ADR-006: AI Integration Architecture

**Status**: Accepted  
**Date**: 2025-07-20  
**Deciders**: Engineering Team, AI Team

### Context

AI integration requirements:
- Real-time streaming chat responses
- Context-aware assistance based on wizard step
- Function calling for wizard field suggestions
- Token usage optimization
- Rate limiting and error handling

### Decision

**Selected**: OpenAI GPT-4o-mini with AI SDK

**Alternatives Considered**:
- Anthropic Claude (via Anthropic SDK)
- Custom LLM hosting (Ollama, vLLM)
- Azure OpenAI Service
- Google Gemini API

### Rationale

**OpenAI GPT-4o-mini Advantages**:
- **Cost Effective**: Significantly cheaper than GPT-4
- **Performance**: Fast response times suitable for real-time chat
- **Function Calling**: Native support for structured data extraction
- **Streaming**: Excellent streaming response support
- **Context Window**: 128k context window for chat history

**AI SDK Benefits**:
- **Framework Agnostic**: Works with React, Vue, Svelte
- **Streaming**: Built-in streaming with React hooks
- **Edge Runtime**: Compatible with Vercel Edge functions
- **Type Safety**: TypeScript support with proper typing

### Implementation

```typescript
// Chat service with streaming
import { OpenAI } from 'openai';
import { streamText } from 'ai';

export async function chatStream(
  messages: Message[],
  stepContext: string
) {
  const result = await streamText({
    model: openai('gpt-4o-mini'),
    messages: [
      {
        role: 'system',
        content: buildSystemPrompt(stepContext)
      },
      ...messages
    ],
    tools: {
      suggest_answer: {
        description: 'Suggest an answer for a wizard field',
        parameters: z.object({
          questionKey: z.string(),
          suggestedValue: z.any(),
          confidence: z.number().min(0).max(1)
        })
      }
    }
  });

  return result.toAIStream();
}

// React integration
const { messages, input, handleInputChange, handleSubmit } = useChat({
  api: '/api/chat',
  onFinish: (message) => {
    // Handle function calls
    if (message.function_call) {
      handleFunctionCall(message.function_call);
    }
  }
});
```

### Consequences

**Positive**:
- Excellent real-time chat experience
- Cost-effective AI integration
- Robust function calling for wizard assistance
- Great developer experience with AI SDK

**Negative**:
- Vendor lock-in with OpenAI
- Potential rate limiting issues at scale
- Token costs increase with usage

---

## ADR-007: File Storage Solution

**Status**: Accepted  
**Date**: 2025-07-20  
**Deciders**: Engineering Team, DevOps Team

### Context

File storage requirements:
- PDF report generation and storage
- Secure file access with signed URLs
- Scalable storage for growing user base
- Cost-effective pricing model
- Integration with existing infrastructure

### Decision

**Selected**: Cloudflare R2

**Alternatives Considered**:
- AWS S3 (standard object storage)
- Vercel Blob (integrated storage)
- Google Cloud Storage
- Azure Blob Storage

### Rationale

**Cloudflare R2 Advantages**:
- **Cost Effective**: No egress fees, competitive storage pricing
- **Performance**: Global edge network for fast access
- **S3 Compatibility**: Drop-in replacement for S3 APIs
- **Security**: Built-in DDoS protection and security features
- **Integration**: Excellent integration with Cloudflare ecosystem

**Technical Benefits**:
- Signed URL support for secure access
- Lifecycle policies for automatic cleanup
- Object versioning for backup/recovery
- Global distribution for low latency

### Implementation

```typescript
// R2 integration
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
});

// Upload PDF
async function uploadPDF(sessionId: string, pdfBuffer: Buffer) {
  const key = `reports/${sessionId}.pdf`;
  
  await r2Client.send(new PutObjectCommand({
    Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
    Key: key,
    Body: pdfBuffer,
    ContentType: 'application/pdf',
    Metadata: {
      sessionId,
      generatedAt: new Date().toISOString()
    }
  }));
  
  return key;
}

// Generate signed URL
async function getSignedDownloadURL(key: string) {
  const command = new GetObjectCommand({
    Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
    Key: key
  });
  
  return getSignedUrl(r2Client, command, { expiresIn: 7 * 24 * 60 * 60 }); // 7 days
}
```

### Consequences

**Positive**:
- Significant cost savings on data egress
- Excellent performance with global distribution
- S3-compatible APIs reduce vendor lock-in
- Strong security and reliability

**Negative**:
- Smaller ecosystem compared to AWS S3
- Limited advanced features compared to cloud-native solutions
- Dependency on Cloudflare infrastructure

---

## ADR-008: Deployment Platform

**Status**: Accepted  
**Date**: 2025-07-20  
**Deciders**: Engineering Team, DevOps Team

### Context

Deployment requirements:
- Serverless architecture for cost efficiency
- Edge runtime for low latency
- Automatic scaling to handle traffic spikes
- CI/CD integration with GitHub
- Preview deployments for testing

### Decision

**Selected**: Vercel

**Alternatives Considered**:
- AWS Lambda + CloudFront
- Google Cloud Run
- Railway (full-stack platform)
- Netlify + Supabase Edge Functions

### Rationale

**Vercel Advantages**:
- **Edge Runtime**: Native Edge Runtime support for API routes
- **Performance**: Automatic edge caching and optimization
- **Developer Experience**: Excellent Next.js/Astro integration
- **Scaling**: Automatic scaling with zero configuration
- **CI/CD**: Built-in GitHub integration with preview deployments

**Key Features**:
- Edge middleware for authentication
- Serverless functions with Edge Runtime
- Automatic SSL and CDN
- Real-time analytics and monitoring

### Implementation

```typescript
// vercel.json configuration
{
  "functions": {
    "src/pages/api/**/*.ts": {
      "runtime": "edge"
    }
  },
  "env": {
    "DATABASE_URL": "@database-url",
    "CLERK_SECRET_KEY": "@clerk-secret-key"
  },
  "build": {
    "env": {
      "NODE_ENV": "production"
    }
  }
}

// Edge middleware
import { clerkMiddleware } from '@clerk/nextjs/server';

export default clerkMiddleware();

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)'
  ]
};
```

**Deployment Pipeline**:
1. **GitHub Integration**: Automatic deployments on push
2. **Preview Deployments**: Every PR gets a preview URL
3. **Production Deployment**: Automatic production deploys from main branch
4. **Environment Management**: Separate environments for dev/staging/prod

### Consequences

**Positive**:
- Excellent developer experience with zero-config deployments
- Automatic scaling and performance optimization
- Built-in monitoring and analytics
- Strong security with edge middleware

**Negative**:
- Vendor lock-in with Vercel platform
- Pricing can be expensive at scale
- Limited control over underlying infrastructure

---

## Decision Impact Summary

| Decision | Impact on Performance | Impact on Cost | Impact on Complexity |
|----------|----------------------|---------------|---------------------|
| Astro + React | ⬆️ High | ⬇️ Low | ⬇️ Low |
| Clerk Auth | ➡️ Neutral | ⬆️ Medium | ⬇️ Low |
| PostgreSQL + pgvector | ⬆️ High | ⬇️ Low | ⬆️ Medium |
| tRPC | ⬆️ High | ➡️ Neutral | ⬇️ Low |
| Zustand + TanStack Query | ⬆️ High | ⬇️ Low | ⬇️ Low |
| OpenAI + AI SDK | ⬆️ High | ⬆️ Medium | ⬇️ Low |
| Cloudflare R2 | ⬆️ High | ⬇️ Low | ⬇️ Low |
| Vercel | ⬆️ High | ⬆️ Medium | ⬇️ Low |

**Overall Impact**: High performance, medium cost, low complexity system optimized for developer productivity and user experience.

---

*These architecture decisions form the foundation of the ARA application design and implementation. Each decision was made considering technical requirements, team expertise, cost implications, and long-term maintainability.*