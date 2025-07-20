# Agent Readiness Audit (ARA) System

**A comprehensive wizard-first web application for assessing organizational readiness for AI agent implementation.**

---

## 🎯 Overview

The ARA system provides organizations with a detailed assessment of their technical, operational, security, and business readiness for implementing AI agents. Built with modern web technologies and a focus on user experience.

### Key Features

- **Multi-step Wizard Interface**: Comprehensive assessment through guided steps
- **Dual Authentication Flow**: Support for both authenticated users and guest sessions
- **Real-time Chat Integration**: AI-powered assistance during assessment
- **PDF Report Generation**: Automated scoring and recommendations
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices

---

## 🚀 Quick Start

### Prerequisites

- **Node.js**: Version 20.x or higher
- **PostgreSQL**: Version 15+ with pgvector extension
- **npm**: Version 10.x or higher

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd appstoagents-ara

# Install dependencies
npm install

# Environment variables are already configured in .env
# Edit them as needed for your setup
nano .env

# Setup database
npm run db:migrate
npm run db:seed

# Start development server
npm run dev
```

**Application will be available at**: `http://localhost:4321`

---

## 🏗️ Architecture

### Technology Stack

- **Frontend**: Astro v4 + React 18 (Islands Architecture)
- **Backend**: tRPC v11 + Vercel Edge Runtime
- **Database**: PostgreSQL 15 + pgvector + Prisma ORM
- **Authentication**: Clerk with dual guest/authenticated flow
- **AI Integration**: OpenAI GPT-4o-mini with streaming
- **Storage**: Cloudflare R2 for PDF reports
- **Caching**: Upstash Redis for performance optimization
- **Styling**: TailwindCSS + DaisyUI

### Project Structure

```
/
├── prisma/                 # Database schema and migrations
├── public/                 # Static assets
├── src/
│   ├── components/         # React components
│   │   ├── islands/        # Astro islands (interactive components)
│   │   ├── wizard/         # Wizard-specific components
│   │   └── shared/         # Shared components
│   ├── config/             # Configuration files
│   ├── pages/              # Astro pages and API routes
│   ├── server/             # tRPC routers and middleware
│   ├── services/           # Business logic services
│   ├── store/              # State management (Zustand)
│   ├── types/              # TypeScript type definitions
│   └── utils/              # Utility functions
├── docs/                   # Documentation
└── resources/              # Project planning and design docs
```

---

## 🧞 Commands

All commands are run from the root of the project:

| Command | Action |
|:--------|:-------|
| `npm install` | Installs dependencies |
| `npm run dev` | Starts local dev server at `localhost:4321` |
| `npm run build` | Build your production site to `./dist/` |
| `npm run preview` | Preview your build locally, before deploying |
| `npm run check` | Run Astro check for diagnostics |
| `npm run type-check` | Run TypeScript checks |
| `npm run lint` | Run ESLint (when configured) |
| `npm run format` | Format code with Prettier |

### Database Commands

| Command | Action |
|:--------|:-------|
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema changes to database |
| `npm run db:migrate` | Run database migrations |
| `npm run db:seed` | Seed database with sample data |

### Testing Commands

| Command | Action |
|:--------|:-------|
| `npm run test` | Run unit tests (when configured) |
| `npm run test:e2e` | Run end-to-end tests (when configured) |

---

## 📖 Documentation

- **[Setup Guide](./docs/setup-guide.md)**: Complete development environment setup
- **[Architecture Decisions](./docs/architecture-decisions.md)**: Technical design decisions
- **[API Reference](./docs/api-reference.md)**: API endpoints and schemas
- **[Deployment Guide](./docs/deployment-guide.md)**: Production deployment instructions

### Implementation Resources

- **[Implementation Plan](./resources/ARA-Implementation-Plan.md)**: Detailed project roadmap
- **[System Design](./resources/ARA-System-Design.md)**: Technical architecture and design
- **[Technical Requirements](./resources/TRD.md)**: Technical requirements document

---

## 🛠️ Development

### Environment Configuration

The project uses environment variables defined in `.env`. Key variables include:

```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/ara_db"

# Authentication (Clerk)
CLERK_SECRET_KEY="sk_test_..."
PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."

# AI Integration
OPENAI_API_KEY="sk-..."

# Development
NODE_ENV="development"
```

### Core Features Status

- ✅ **Task 1.1**: Project Setup & Infrastructure
- ✅ **Task 1.2**: Database Schema Implementation  
- ✅ **Task 1.3**: Authentication Integration (In Progress)
- ✅ **Task 1.4**: Core Wizard Component
- 🔄 **Task 1.5**: Basic Scoring Engine (Next)

### Contributing

1. **Create Feature Branch**: `git checkout -b feature/your-feature`
2. **Make Changes**: Follow project conventions and add tests
3. **Test Changes**: Run `npm run type-check` and tests
4. **Commit Changes**: Use conventional commit messages
5. **Create Pull Request**: Submit for review

---

## 📞 Support

For questions, issues, or contributions:

- **Issues**: Create an issue in the repository
- **Documentation**: Check the `docs/` directory
- **Architecture**: Review `resources/` for design documents

---

## 📄 License

This project is part of the Agent Readiness Audit system implementation.

---

*Built with ❤️ using Astro, React, tRPC, and modern web technologies.*