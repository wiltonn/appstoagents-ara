# Development Setup Guide

**Complete setup instructions for the ARA development environment**

---

## Prerequisites

### System Requirements
- **Node.js**: Version 20.x or higher
- **npm**: Version 10.x or higher (comes with Node.js)
- **Git**: Latest version
- **PostgreSQL**: Version 15+ with pgvector extension
- **Docker**: Optional, for database setup

### Account Requirements
- **Clerk Account**: For authentication services
- **OpenAI Account**: For GPT-4o-mini API access
- **Vercel Account**: For deployment (optional for development)
- **Cloudflare Account**: For R2 storage (optional for development)

---

## Quick Setup

### 1. Clone Repository

```bash
git clone <repository-url>
cd appstoagents-ara
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

```bash
# Environment variables are already configured in .env
# Edit environment variables as needed
nano .env
```

### 4. Database Setup

```bash
# Start PostgreSQL (if using Docker)
docker run --name ara-postgres \
  -e POSTGRES_PASSWORD=dev123 \
  -e POSTGRES_DB=ara_dev \
  -p 5432:5432 \
  -d postgres:15

# Install pgvector extension
docker exec -it ara-postgres psql -U postgres -d ara_dev -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Run migrations
npx prisma migrate dev

# Seed database
npx prisma db seed
```

### 5. Start Development

```bash
npm run dev
```

**Application will be available at**: `http://localhost:4321`

---

## Detailed Setup Instructions

### Node.js Installation

#### macOS (using Homebrew)
```bash
brew install node@20
```

#### Windows (using Chocolatey)
```bash
choco install nodejs --version=20.0.0
```

#### Linux (using NodeSource)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### Verify Installation
```bash
node --version  # Should output v20.x.x
npm --version   # Should output 10.x.x
```

### PostgreSQL Setup

#### Option 1: Docker (Recommended)

```bash
# Start PostgreSQL with pgvector
docker run --name ara-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=dev123 \
  -e POSTGRES_DB=ara_dev \
  -p 5432:5432 \
  -d postgres:15

# Install pgvector extension
docker exec -it ara-postgres psql -U postgres -d ara_dev -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Verify setup
docker exec -it ara-postgres psql -U postgres -d ara_dev -c "SELECT * FROM pg_extension WHERE extname = 'vector';"
```

#### Option 2: Local Installation

**macOS (Homebrew)**:
```bash
brew install postgresql@15
brew services start postgresql@15

# Install pgvector
git clone https://github.com/pgvector/pgvector.git
cd pgvector
make
make install

# Create database
createdb ara_dev
psql ara_dev -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

**Ubuntu/Debian**:
```bash
sudo apt update
sudo apt install postgresql-15 postgresql-client-15 postgresql-contrib-15

# Install pgvector
sudo apt install postgresql-15-pgvector

# Create database
sudo -u postgres createdb ara_dev
sudo -u postgres psql ara_dev -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### Environment Variables

The `.env` file should contain the following variables:

```bash
# Database
DATABASE_URL="postgresql://postgres:dev123@localhost:5432/ara_dev"

# Authentication (Clerk)
CLERK_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_JWT_KEY="-----BEGIN PUBLIC KEY-----..."

# AI Services
OPENAI_API_KEY="sk-..."

# File Storage (Development - optional)
CLOUDFLARE_R2_ACCESS_KEY_ID="..."
CLOUDFLARE_R2_SECRET_ACCESS_KEY="..."
CLOUDFLARE_R2_BUCKET_NAME="ara-dev-reports"

# Caching (Development - optional)
UPSTASH_REDIS_URL="redis://localhost:6379"

# Application
NEXT_PUBLIC_APP_URL="http://localhost:4321"
NODE_ENV="development"

# Encryption
ENCRYPTION_KEY="your-32-char-encryption-key-here"

# Rate Limiting
RATE_LIMIT_ENABLED="true"
```

### Service Account Setup

#### Clerk Authentication

1. **Create Clerk Application**:
   - Go to [Clerk Dashboard](https://dashboard.clerk.dev)
   - Create new application
   - Choose "Email" and "OAuth" (Google, GitHub) as sign-in methods

2. **Configure Settings**:
   ```json
   {
     "sign_up": {
       "mode": "public",
       "captcha": false
     },
     "sign_in": {
       "second_factor": "optional"
     },
     "session": {
       "token_lifetime": 3600
     }
   }
   ```

3. **Get API Keys**:
   - Copy Publishable Key to `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - Copy Secret Key to `CLERK_SECRET_KEY`
   - Download JWT Public Key to `CLERK_JWT_KEY`

#### OpenAI API Setup

1. **Get API Key**:
   - Go to [OpenAI API](https://platform.openai.com/api-keys)
   - Create new secret key
   - Copy to `OPENAI_API_KEY`

2. **Set Usage Limits**:
   - Configure monthly spending limit
   - Set rate limits for development

#### Cloudflare R2 Setup (Optional)

1. **Create R2 Bucket**:
   ```bash
   # Using Cloudflare CLI
   npx wrangler r2 bucket create ara-dev-reports
   ```

2. **Get API Credentials**:
   - Go to Cloudflare Dashboard → R2 → Manage R2 API Tokens
   - Create token with edit permissions
   - Copy credentials to environment variables

---

## Database Schema Setup

### Run Migrations

```bash
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev --name init

# Verify schema
npx prisma db push
```

### Seed Database

```bash
# Run seed script
npx prisma db seed

# Verify data
npx prisma studio
```

**Seed script creates**:
- Sample scoring configuration
- Test wizard questions
- Example chat prompts

### Database Administration

```bash
# Open Prisma Studio (database GUI)
npx prisma studio

# Reset database (development only)
npx prisma migrate reset

# View migration status
npx prisma migrate status

# Generate new migration
npx prisma migrate dev --name add_new_feature
```

---

## Development Scripts

### Available Commands

```bash
# Development
npm run dev          # Start development server
npm run dev:db       # Start database only
npm run dev:debug    # Start with debugging enabled

# Building
npm run build        # Build for production
npm run preview      # Preview production build
npm run build:check  # Build with type checking

# Code Quality
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues
npm run type-check   # Run TypeScript checks
npm run format       # Format code with Prettier

# Testing
npm run test         # Run unit tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage
npm run test:e2e     # Run end-to-end tests

# Database
npm run db:migrate   # Run database migrations
npm run db:seed      # Seed database
npm run db:studio    # Open Prisma Studio
npm run db:reset     # Reset database (dev only)

# Production
npm run start        # Start production server
npm run deploy       # Deploy to Vercel
```

### Custom Scripts Configuration

Add to `package.json`:

```json
{
  "scripts": {
    "dev:full": "concurrently \"npm run dev:db\" \"npm run dev\"",
    "dev:clean": "rm -rf .next && npm run dev",
    "test:ci": "npm run lint && npm run type-check && npm run test",
    "db:backup": "pg_dump $DATABASE_URL > backup.sql",
    "db:restore": "psql $DATABASE_URL < backup.sql"
  }
}
```

---

## IDE Configuration

### VS Code Extensions

Install recommended extensions:

```json
{
  "recommendations": [
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "ms-vscode.vscode-typescript-next",
    "prisma.prisma",
    "astro-build.astro-vscode",
    "ms-vscode.vscode-json"
  ]
}
```

### VS Code Settings

Create `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "tailwindCSS.experimental.classRegex": [
    ["cn\\(([^)]*)\\)", "'([^']*)'"],
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"]
  ]
}
```

### Git Configuration

Configure Git hooks:

```bash
# Install Husky for Git hooks
npm install --save-dev husky

# Setup pre-commit hooks
npx husky add .husky/pre-commit "npm run lint && npm run type-check"
npx husky add .husky/commit-msg "npx commitlint --edit $1"
```

---

## Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Kill process using port 4321
lsof -ti:4321 | xargs kill -9

# Or use different port
npm run dev -- --port 3000
```

#### Database Connection Issues
```bash
# Check PostgreSQL status
docker ps -a | grep postgres

# Check database connectivity
npx prisma db pull

# Reset database connection
npm run db:reset
```

#### Node.js Version Issues
```bash
# Use Node Version Manager
nvm install 20
nvm use 20

# Verify version
node --version
```

#### Permission Issues (macOS/Linux)
```bash
# Fix npm permissions
sudo chown -R $(whoami) ~/.npm

# Or use Node Version Manager
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
```

### Environment Issues

#### Missing Environment Variables
```bash
# Verify environment variables
node -e "console.log(process.env)" | grep -E "(DATABASE_URL|CLERK|OPENAI)"

# Test database connection
npx prisma db pull
```

#### Service Connectivity
```bash
# Test OpenAI API
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# Test Clerk API
curl https://api.clerk.dev/v1/users \
  -H "Authorization: Bearer $CLERK_SECRET_KEY"
```

### Performance Issues

#### Slow Development Server
```bash
# Clear Next.js cache
rm -rf .next

# Increase Node.js memory
export NODE_OPTIONS="--max-old-space-size=4096"
npm run dev
```

#### Database Performance
```bash
# Check database performance
docker stats ara-postgres

# Optimize database
npx prisma db push --accept-data-loss
```

---

## Development Workflow

### Feature Development

1. **Create Feature Branch**:
   ```bash
   git checkout -b feature/wizard-autosave
   ```

2. **Make Changes**:
   - Write code following project conventions
   - Add tests for new functionality
   - Update documentation

3. **Test Changes**:
   ```bash
   npm run test:ci
   npm run test:e2e
   ```

4. **Commit Changes**:
   ```bash
   git add .
   git commit -m "feat: add wizard auto-save functionality"
   ```

5. **Push and Create PR**:
   ```bash
   git push origin feature/wizard-autosave
   # Create pull request via GitHub
   ```

### Database Changes

1. **Modify Schema**:
   - Edit `prisma/schema.prisma`
   - Add new models or fields

2. **Generate Migration**:
   ```bash
   npx prisma migrate dev --name add_new_table
   ```

3. **Update Seed Data**:
   - Modify `prisma/seed.ts` if needed
   - Test with fresh database

4. **Test Migration**:
   ```bash
   npm run db:reset
   npm run db:seed
   ```

---

## Next Steps

After successful setup:

1. **Explore the Codebase**:
   - Review [Architecture Decisions](./architecture-decisions.md)
   - Check [API Reference](./api-reference.md)
   - Study component structure

2. **Run Tests**:
   ```bash
   npm run test
   npm run test:e2e
   ```

3. **Start Development**:
   - Create feature branch
   - Begin implementing wizard components
   - Test with real API integrations

4. **Join the Team**:
   - Read coding standards
   - Set up development tools
   - Review pull request process

---

*For additional help, see [Troubleshooting Guide](./troubleshooting.md) or contact the development team.*