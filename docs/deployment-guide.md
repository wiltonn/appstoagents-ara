# ARA System Deployment Guide

**Version**: 1.0.0  
**Last Updated**: January 21, 2025  
**Target Audience**: DevOps Engineers, System Administrators

---

## 🏗️ Infrastructure Overview

The ARA System is deployed as a modern serverless application with the following components:

- **Frontend & API**: Vercel Edge Runtime
- **Database**: PostgreSQL with pgvector (Neon/Supabase/Railway)
- **Caching**: Upstash Redis
- **Storage**: Cloudflare R2
- **Authentication**: Clerk
- **AI Services**: OpenAI GPT-4o-mini
- **Monitoring**: OpenTelemetry + your preferred observability platform

---

## 🚀 Quick Start Deployment

### Prerequisites
- Node.js 18+ installed
- Git repository access
- Vercel account
- Database provider account (Neon recommended)
- Redis provider account (Upstash recommended)

### 1. Environment Setup

Create a `.env.local` file with the required environment variables:

```bash
# Database
DATABASE_URL="postgresql://username:password@host:port/database?sslmode=require"
DIRECT_URL="postgresql://username:password@host:port/database?sslmode=require"

# Authentication (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL="/wizard"
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL="/wizard"

# AI Integration
OPENAI_API_KEY="sk-..."

# Redis Cache
REDIS_URL="redis://default:password@host:port"
REDIS_HOST="host"
REDIS_PORT="6379"
REDIS_PASSWORD="password"

# Storage (Cloudflare R2)
CLOUDFLARE_R2_ACCOUNT_ID="account_id"
CLOUDFLARE_R2_ACCESS_KEY="access_key"
CLOUDFLARE_R2_SECRET_KEY="secret_key"
CLOUDFLARE_R2_BUCKET_NAME="ara-reports"

# Application
NEXT_PUBLIC_APP_URL="https://your-domain.vercel.app"
NODE_ENV="production"
```

### 2. Database Setup

#### Option A: Neon (Recommended)
1. Create account at [neon.tech](https://neon.tech)
2. Create new project with PostgreSQL 15+
3. Enable pgvector extension:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

#### Option B: Supabase
1. Create account at [supabase.com](https://supabase.com)
2. Create new project
3. Enable pgvector in SQL editor:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

### 3. Redis Setup (Upstash)
1. Create account at [upstash.com](https://upstash.com)
2. Create Redis database
3. Copy connection details to environment variables

### 4. Cloudflare R2 Setup
1. Create Cloudflare account
2. Navigate to R2 Object Storage
3. Create bucket for PDF reports
4. Generate API tokens with R2 permissions

### 5. Clerk Authentication Setup
1. Create account at [clerk.dev](https://clerk.dev)
2. Create new application
3. Configure OAuth providers (Google, GitHub recommended)
4. Copy API keys to environment variables

### 6. Deploy to Vercel

#### Option A: Vercel CLI
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod
```

#### Option B: GitHub Integration
1. Connect GitHub repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### 7. Database Migration
```bash
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma db push

# Optional: Seed database
npx prisma db seed
```

---

## 🔧 Detailed Configuration

### Environment Variables Reference

#### Required Variables
| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `CLERK_SECRET_KEY` | Clerk authentication secret | `sk_test_...` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-...` |
| `REDIS_URL` | Redis connection string | `redis://default:pass@host:6379` |

#### Optional Variables
| Variable | Description | Default |
|----------|-------------|---------|
| `MAX_CONCURRENT_REQUESTS` | Rate limiting | `100` |
| `PDF_GENERATION_TIMEOUT` | PDF timeout (ms) | `30000` |
| `CHAT_MESSAGE_LIMIT` | Max chat messages | `1000` |
| `SESSION_CLEANUP_INTERVAL` | Cleanup interval (hours) | `24` |

### Vercel Deployment Configuration

#### vercel.json
```json
{
  "framework": "astro",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm install",
  "devCommand": "npm run dev",
  "functions": {
    "src/pages/api/**/*": {
      "runtime": "edge"
    }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Access-Control-Allow-Origin",
          "value": "*"
        },
        {
          "key": "Access-Control-Allow-Methods",
          "value": "GET, POST, PUT, DELETE, OPTIONS"
        },
        {
          "key": "Access-Control-Allow-Headers",
          "value": "Content-Type, Authorization"
        }
      ]
    }
  ]
}
```

---

## 🌍 Multi-Environment Setup

### Environment Strategy
- **Development**: Local development with Docker Compose
- **Staging**: Vercel preview deployments with staging database
- **Production**: Vercel production deployment with production database

### Deployment Pipeline

#### GitHub Actions Workflow
```yaml
name: Deploy
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test
      - run: npm run build

  deploy-production:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

---

## 🔍 Monitoring & Health Checks

### Application Health Endpoint
```typescript
// /api/health
export default async function handler(req: Request) {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version,
    uptime: process.uptime(),
    dependencies: {
      database: await checkDatabase(),
      redis: await checkRedis(),
      openai: await checkOpenAI(),
      storage: await checkStorage(),
    },
  };

  const allHealthy = Object.values(health.dependencies)
    .every(dep => dep.status === 'connected');

  return new Response(JSON.stringify(health), {
    status: allHealthy ? 200 : 503,
    headers: { 'Content-Type': 'application/json' },
  });
}
```

### Security Configuration

#### Security Headers Middleware
```typescript
export function securityHeaders() {
  return {
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://clerk.dev",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "connect-src 'self' https://api.openai.com https://clerk.dev",
    ].join('; '),
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  };
}
```

---

## 🚨 Disaster Recovery

### Database Backups
```bash
#!/bin/bash
# Automated database backup script

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/backups/ara-system"
DB_NAME="ara_production"

# Create backup directory
mkdir -p $BACKUP_DIR

# Perform backup
pg_dump $DATABASE_URL > "$BACKUP_DIR/ara_backup_$TIMESTAMP.sql"

# Compress backup
gzip "$BACKUP_DIR/ara_backup_$TIMESTAMP.sql"

# Upload to cloud storage
aws s3 cp "$BACKUP_DIR/ara_backup_$TIMESTAMP.sql.gz" s3://ara-backups/

# Clean up old backups (keep last 30 days)
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
```

### Recovery Procedures

#### Application Recovery
```bash
# Rollback to previous deployment
vercel rollback

# Or redeploy from specific commit
vercel --prod --force
```

---

## 🔧 Troubleshooting

### Common Issues

#### Database Connection Issues
```bash
# Check database connectivity
psql $DATABASE_URL -c "SELECT 1;"

# Verify pgvector extension
psql $DATABASE_URL -c "SELECT * FROM pg_extension WHERE extname = 'vector';"

# Check connection pool status
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'ara_production';"
```

#### Redis Connection Issues
```bash
# Test Redis connectivity
redis-cli -u $REDIS_URL ping

# Check Redis memory usage
redis-cli -u $REDIS_URL info memory

# Monitor Redis operations
redis-cli -u $REDIS_URL monitor
```

---

## 📚 Additional Resources

### Documentation Links
- [Vercel Documentation](https://vercel.com/docs)
- [Astro Documentation](https://docs.astro.build/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [Clerk Documentation](https://clerk.dev/docs)

### Support Contacts
- **Technical Issues**: [Technical Support Email]
- **Infrastructure**: [DevOps Team Email]
- **Security**: [Security Team Email]

---

*This deployment guide is maintained by the ARA System team and updated with each major release.*