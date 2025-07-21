# ARA System Developer Onboarding Guide

**Version**: 1.0.0  
**Last Updated**: January 21, 2025  
**Target Audience**: New Developers, Engineers

---

## 🎯 Welcome to the ARA System

The Agent Readiness Audit (ARA) System is a modern full-stack application that helps organizations assess their readiness for AI agent adoption. This guide will get you up and running as a productive team member.

### What You'll Learn
- System architecture and technology stack
- Local development environment setup
- Code organization and patterns
- Development workflow and best practices
- Testing and deployment procedures

---

## 🏗️ System Architecture Overview

### Technology Stack
- **Frontend**: Astro v4 + React 18 (Islands Architecture)
- **Backend**: tRPC v11 with Vercel Edge Runtime
- **Database**: PostgreSQL 15 + pgvector + Prisma ORM
- **Authentication**: Clerk (dual guest/authenticated flow)
- **AI Integration**: OpenAI GPT-4o-mini with streaming
- **Storage**: Cloudflare R2 for PDF reports
- **Caching**: Upstash Redis
- **Styling**: TailwindCSS + DaisyUI
- **Deployment**: Vercel Edge

### Core Concepts
1. **Dual User Flow**: Guest users (anonymous) + Authenticated users (Clerk)
2. **Islands Architecture**: Server-rendered pages with interactive React islands
3. **Type Safety**: End-to-end TypeScript from database to frontend
4. **Real-time Features**: WebSocket chat with AI streaming responses
5. **Configurable Scoring**: Hot-reloadable scoring algorithms

---

## 🛠️ Development Environment Setup

### Prerequisites
Ensure you have the following installed:
- **Node.js 18+** (use `nvm` for version management)
- **Git** (latest version)
- **VS Code** (recommended editor)
- **Docker** (for local database)

### 1. Repository Setup

```bash
# Clone the repository
git clone https://github.com/your-org/appstoagents-ara.git
cd appstoagents-ara

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local
```

### 2. Environment Configuration

Edit `.env.local` with the following required variables:

```bash
# Database (Local PostgreSQL)
DATABASE_URL="postgresql://postgres:password@localhost:5432/ara_development"
DIRECT_URL="postgresql://postgres:password@localhost:5432/ara_development"

# Authentication (Clerk - Development Keys)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_[get_from_team]"
CLERK_SECRET_KEY="sk_test_[get_from_team]"
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL="/wizard"
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL="/wizard"

# AI Integration (OpenAI - Development Key)
OPENAI_API_KEY="sk-[get_from_team]"

# Redis (Local or Upstash Development)
REDIS_URL="redis://localhost:6379"
REDIS_HOST="localhost"
REDIS_PORT="6379"
REDIS_PASSWORD=""

# Application
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NODE_ENV="development"
```

### 3. Local Database Setup

#### Option A: Docker Compose (Recommended)
```bash
# Start PostgreSQL with pgvector
docker-compose up -d db

# Verify database is running
docker-compose ps
```

#### Option B: Local PostgreSQL Installation
```bash
# Install PostgreSQL (macOS)
brew install postgresql@15
brew services start postgresql@15

# Create database
createdb ara_development

# Install pgvector extension
psql ara_development -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### 4. Database Migration

```bash
# Generate Prisma client
npx prisma generate

# Apply database schema
npx prisma db push

# Optional: Seed development data
npx prisma db seed
```

### 5. Redis Setup

#### Option A: Docker
```bash
# Start Redis via Docker Compose
docker-compose up -d redis
```

#### Option B: Local Installation
```bash
# Install Redis (macOS)
brew install redis
brew services start redis

# Test connection
redis-cli ping
```

### 6. Start Development Server

```bash
# Start the development server
npm run dev

# Server will be available at http://localhost:3000
```

### 7. Verify Setup

Open your browser and navigate to:
- **Main App**: http://localhost:3000
- **API Health**: http://localhost:3000/api/health
- **Wizard**: http://localhost:3000/wizard

---

## 📁 Project Structure

```
appstoagents-ara/
├── 📁 src/
│   ├── 📁 components/          # Reusable React components
│   │   ├── 📁 islands/         # Astro React islands
│   │   ├── 📁 ui/              # UI components (buttons, forms, etc.)
│   │   └── 📁 wizard/          # Wizard-specific components
│   ├── 📁 layouts/             # Astro layouts
│   ├── 📁 pages/               # Astro pages (file-based routing)
│   │   └── 📁 api/             # API endpoints (tRPC)
│   ├── 📁 server/              # Backend code
│   │   ├── 📁 routers/         # tRPC routers
│   │   ├── trpc.ts             # tRPC setup
│   │   └── router.ts           # Main router
│   ├── 📁 lib/                 # Shared utilities
│   │   ├── scoring.ts          # Scoring engine
│   │   ├── jobQueue.ts         # PDF generation queue
│   │   └── openai.ts           # AI integration
│   ├── 📁 utils/               # Helper functions
│   │   ├── db.ts               # Database utilities
│   │   └── auth.ts             # Authentication helpers
│   ├── 📁 types/               # TypeScript type definitions
│   ├── 📁 config/              # Configuration files
│   └── 📁 styles/              # CSS and styling
├── 📁 prisma/                  # Database schema and migrations
│   ├── schema.prisma           # Prisma schema
│   └── seed.ts                 # Database seeding
├── 📁 docs/                    # Documentation
├── 📁 tests/                   # Test files
├── 📁 public/                  # Static assets
├── package.json                # Dependencies and scripts
├── astro.config.mjs            # Astro configuration
├── tailwind.config.mjs         # TailwindCSS configuration
└── tsconfig.json               # TypeScript configuration
```

---

## 🔧 Development Workflow

### Git Workflow

We use **Git Flow** with the following branches:
- `main`: Production-ready code
- `develop`: Integration branch for features
- `feature/*`: Individual feature branches
- `hotfix/*`: Emergency fixes for production

#### Starting a New Feature
```bash
# Create and switch to feature branch
git checkout -b feature/your-feature-name develop

# Make your changes and commit
git add .
git commit -m "feat: add new wizard step validation"

# Push and create pull request
git push origin feature/your-feature-name
```

### Code Style & Formatting

We use automated tooling for consistent code style:

```bash
# Run ESLint
npm run lint

# Fix auto-fixable issues
npm run lint:fix

# Format code with Prettier
npm run format

# Type checking
npm run type-check
```

### Development Scripts

```bash
# Development
npm run dev              # Start development server
npm run build            # Build for production
npm run preview          # Preview production build

# Code Quality
npm run lint             # Run ESLint
npm run format           # Format with Prettier
npm run type-check       # TypeScript type checking

# Database
npm run db:push          # Apply schema changes
npm run db:studio        # Open Prisma Studio
npm run db:seed          # Seed development data
npm run db:reset         # Reset database

# Testing
npm run test             # Run all tests
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests
npm run test:e2e         # End-to-end tests
```

---

## 🧩 Key Components & Patterns

### 1. tRPC API Development

#### Creating a New Router
```typescript
// src/server/routers/example.ts
import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../trpc';

export const exampleRouter = router({
  // Public endpoint
  getPublicData: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      // Implementation
    }),

  // Protected endpoint
  createData: protectedProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // ctx.user is available for authenticated users
    }),
});
```

#### Adding to Main Router
```typescript
// src/server/router.ts
import { exampleRouter } from './routers/example';

export const appRouter = router({
  wizard: wizardRouter,
  chat: chatRouter,
  reports: reportsRouter,
  example: exampleRouter, // Add your router here
});
```

### 2. React Island Components

#### Creating an Interactive Island
```typescript
// src/components/islands/ExampleIsland.tsx
import { useState } from 'react';
import { trpc } from '../../utils/trpc';

export default function ExampleIsland() {
  const [data, setData] = useState('');
  
  const mutation = trpc.example.createData.useMutation({
    onSuccess: () => {
      // Handle success
    },
  });

  return (
    <div className="p-4">
      <input 
        value={data}
        onChange={(e) => setData(e.target.value)}
        className="input input-bordered"
      />
      <button 
        onClick={() => mutation.mutate({ name: data })}
        className="btn btn-primary"
      >
        Submit
      </button>
    </div>
  );
}
```

#### Using in Astro Page
```astro
---
// src/pages/example.astro
---

<Layout title="Example Page">
  <h1>Example Page</h1>
  <ExampleIsland client:load />
</Layout>

<script>
  import ExampleIsland from '../components/islands/ExampleIsland';
</script>
```

### 3. Database Operations with Prisma

#### Basic CRUD Operations
```typescript
import { db } from '../utils/db';

// Create
const newSession = await db.auditSession.create({
  data: {
    userId: 'user_123',
    isGuest: false,
    currentStep: 1,
    totalSteps: 8,
    responses: {},
  },
});

// Read
const session = await db.auditSession.findUnique({
  where: { id: sessionId },
  include: { answers: true },
});

// Update
await db.auditSession.update({
  where: { id: sessionId },
  data: { currentStep: 2 },
});

// Delete
await db.auditSession.delete({
  where: { id: sessionId },
});
```

#### Complex Queries
```typescript
// Query with filters and pagination
const sessions = await db.auditSession.findMany({
  where: {
    userId: userId,
    status: 'COMPLETED',
    createdAt: {
      gte: new Date('2025-01-01'),
    },
  },
  orderBy: { createdAt: 'desc' },
  take: 10,
  skip: page * 10,
});

// Aggregation
const stats = await db.auditSession.aggregate({
  where: { status: 'COMPLETED' },
  _count: { id: true },
  _avg: { score: true },
});
```

### 4. Authentication Patterns

#### Checking User Type in API
```typescript
// In tRPC procedure
.mutation(async ({ input, ctx }) => {
  if (ctx.user.type === 'authenticated') {
    // User is authenticated via Clerk
    const userId = ctx.user.id;
  } else {
    // User is a guest
    const sessionId = ctx.user.id;
  }
});
```

#### Frontend Authentication
```typescript
// Using Clerk hooks
import { useUser, useAuth } from '@clerk/clerk-react';

function MyComponent() {
  const { user, isLoaded, isSignedIn } = useUser();
  const { signOut } = useAuth();

  if (!isLoaded) return <div>Loading...</div>;

  return (
    <div>
      {isSignedIn ? (
        <div>
          Welcome, {user.firstName}!
          <button onClick={() => signOut()}>Sign Out</button>
        </div>
      ) : (
        <div>Please sign in</div>
      )}
    </div>
  );
}
```

---

## 🧪 Testing

### Test Structure
```
tests/
├── unit/              # Unit tests
│   ├── lib/           # Library function tests
│   └── utils/         # Utility function tests
├── integration/       # Integration tests
│   ├── api/           # API endpoint tests
│   └── database/      # Database tests
└── e2e/               # End-to-end tests
    ├── wizard/        # Wizard flow tests
    └── chat/          # Chat functionality tests
```

### Writing Unit Tests
```typescript
// tests/unit/lib/scoring.test.ts
import { describe, it, expect } from 'vitest';
import { scoringEngine } from '../../src/lib/scoring';

describe('Scoring Engine', () => {
  it('should calculate correct score', () => {
    const answers = {
      company_size: 'startup',
      ai_usage_scale: 7,
    };
    
    const result = scoringEngine.calculateTotalScore(answers);
    
    expect(result.totalScore).toBeGreaterThan(0);
    expect(result.totalScore).toBeLessThanOrEqual(100);
  });
});
```

### API Integration Tests
```typescript
// tests/integration/api/wizard.test.ts
import { describe, it, expect } from 'vitest';
import { createTRPCMsw } from 'msw-trpc';
import { appRouter } from '../../src/server/router';

describe('Wizard API', () => {
  it('should save answer successfully', async () => {
    const caller = appRouter.createCaller({
      user: { id: 'test_session', type: 'guest' },
    });
    
    const result = await caller.wizard.saveAnswer({
      questionKey: 'company_size',
      value: 'startup',
      stepId: 'step_1',
    });
    
    expect(result.success).toBe(true);
  });
});
```

### E2E Tests with Playwright
```typescript
// tests/e2e/wizard.spec.ts
import { test, expect } from '@playwright/test';

test('complete wizard flow', async ({ page }) => {
  await page.goto('/wizard');
  
  // Step 1: Company size
  await page.locator('[data-testid="option-startup"]').click();
  await page.locator('[data-testid="next-button"]').click();
  
  // Step 2: AI usage scale
  await page.locator('[data-testid="scale-slider"]').fill('7');
  await page.locator('[data-testid="next-button"]').click();
  
  // Verify progress
  await expect(page.locator('[data-testid="progress-bar"]'))
    .toHaveAttribute('aria-valuenow', '2');
});
```

---

## 🚀 Deployment

### Development Deployment
```bash
# Deploy to Vercel preview
vercel

# Deploy to specific environment
vercel --env=staging
```

### Production Deployment
```bash
# Deploy to production
vercel --prod

# Or via GitHub
git push origin main  # Automatically deploys via GitHub Actions
```

---

## 🔍 Debugging & Troubleshooting

### Common Issues

#### Database Connection Issues
```bash
# Check if database is running
docker-compose ps

# View database logs
docker-compose logs db

# Reset database
npm run db:reset
```

#### tRPC Type Issues
```bash
# Regenerate types
npm run db:generate
npm run type-check
```

#### Build Issues
```bash
# Clear cache and rebuild
rm -rf .next node_modules
npm install
npm run build
```

### Debugging Tools

#### Prisma Studio
```bash
# Open database GUI
npm run db:studio
```

#### VS Code Extensions
- **Prisma**: Schema syntax highlighting
- **Tailwind CSS IntelliSense**: CSS class autocomplete
- **ES7+ React/Redux/React-Native snippets**: React snippets
- **Auto Rename Tag**: Automatically rename paired HTML/JSX tags

#### Browser Dev Tools
- **tRPC DevTools**: Install browser extension for API debugging
- **React DevTools**: Debug React components and state
- **Prisma Inspector**: Inspect database queries

---

## 📚 Learning Resources

### Documentation
- [Astro Documentation](https://docs.astro.build/)
- [tRPC Documentation](https://trpc.io/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [Clerk Documentation](https://clerk.dev/docs)
- [TailwindCSS Documentation](https://tailwindcss.com/docs)

### Internal Resources
- [API Documentation](./api-documentation.md)
- [Architecture Decision Records](./architecture/)
- [Deployment Guide](./deployment-guide.md)

### Code Examples
- **Wizard Implementation**: `src/components/wizard/`
- **Chat Integration**: `src/server/routers/chat.ts`
- **Scoring Engine**: `src/lib/scoring.ts`
- **Authentication Flow**: `src/utils/auth.ts`

---

## 👥 Team & Support

### Team Structure
- **Tech Lead**: [Name] - Architecture decisions, code reviews
- **Frontend Engineers**: [Names] - UI/UX implementation
- **Backend Engineers**: [Names] - API and database development
- **DevOps Engineer**: [Name] - Infrastructure and deployment

### Getting Help
1. **Slack Channels**:
   - `#ara-dev` - General development discussion
   - `#ara-bugs` - Bug reports and fixes
   - `#ara-infrastructure` - Deployment and infrastructure

2. **Code Reviews**:
   - All PRs require at least one approval
   - Tag relevant team members based on changes
   - Include tests and documentation updates

3. **Office Hours**:
   - Tech Lead available: Monday/Wednesday 2-4 PM
   - Team standup: Daily at 10 AM
   - Architecture review: Friday 3 PM

### Contributing Guidelines
1. **Create feature branch** from `develop`
2. **Follow naming conventions**: `feature/description`, `bugfix/description`
3. **Write tests** for new functionality
4. **Update documentation** for API changes
5. **Submit PR** with clear description and testing instructions

---

## ✅ Onboarding Checklist

### Day 1
- [ ] Repository cloned and dependencies installed
- [ ] Local development environment running
- [ ] Database connected and seeded
- [ ] Team introductions and Slack channels joined
- [ ] First commit and PR submitted

### Week 1
- [ ] Familiar with project structure and patterns
- [ ] Completed first feature or bug fix
- [ ] Understanding of authentication flow
- [ ] Knowledge of tRPC API patterns
- [ ] E2E tests running locally

### Month 1
- [ ] Contributed to multiple features
- [ ] Understanding of deployment process
- [ ] Knowledge of database design patterns
- [ ] Familiar with monitoring and debugging tools
- [ ] Mentoring other new team members

---

*Welcome to the team! If you have any questions or run into issues, don't hesitate to reach out to your teammates. We're here to help you succeed.*