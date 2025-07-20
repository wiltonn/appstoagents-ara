# Deployment & Operations Guide

**Production deployment and operational procedures for the ARA application**

---

## Overview

The ARA application follows a serverless deployment model using Vercel for hosting, with supporting services for database, authentication, and file storage.

**Deployment Architecture**:
- **Frontend**: Vercel Edge Network (Astro/React)
- **API**: Vercel Edge Functions (tRPC)
- **Database**: Managed PostgreSQL with pgvector
- **Authentication**: Clerk (SaaS)
- **AI Services**: OpenAI API
- **File Storage**: Cloudflare R2
- **Monitoring**: Vercel Analytics + Custom telemetry

---

## Prerequisites

### Required Accounts & Services
- **Vercel Account**: For hosting and edge functions
- **GitHub Account**: For source code and CI/CD
- **PostgreSQL Database**: Managed provider (Neon, Supabase, AWS RDS)
- **Clerk Account**: For authentication services
- **OpenAI Account**: For AI/chat functionality
- **Cloudflare Account**: For R2 file storage
- **Domain Registration**: Custom domain (optional)

### Required Tools
- **Vercel CLI**: `npm install -g vercel`
- **GitHub CLI**: `npm install -g @github/cli`
- **Terraform**: For infrastructure as code (optional)

---

## Environment Setup

### Environment Variables

Create environment variables in Vercel dashboard or use CLI:

```bash
# Production Environment Variables
vercel env add DATABASE_URL production
vercel env add CLERK_SECRET_KEY production
vercel env add CLERK_JWT_KEY production
vercel env add OPENAI_API_KEY production
vercel env add CLOUDFLARE_R2_ACCESS_KEY_ID production
vercel env add CLOUDFLARE_R2_SECRET_ACCESS_KEY production
vercel env add CLOUDFLARE_R2_BUCKET_NAME production
vercel env add ENCRYPTION_KEY production
vercel env add UPSTASH_REDIS_URL production

# Preview Environment Variables
vercel env add DATABASE_URL preview
vercel env add CLERK_SECRET_KEY preview
# ... (repeat for all variables)
```

### Production Environment Values

```bash
# Database
DATABASE_URL="postgresql://user:password@host:5432/ara_prod"

# Authentication (Clerk)
CLERK_SECRET_KEY="sk_live_..."
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_..."
CLERK_JWT_KEY="-----BEGIN PUBLIC KEY-----..."

# AI Services
OPENAI_API_KEY="sk-..."

# File Storage (Cloudflare R2)
CLOUDFLARE_R2_ACCESS_KEY_ID="..."
CLOUDFLARE_R2_SECRET_ACCESS_KEY="..."
CLOUDFLARE_R2_BUCKET_NAME="ara-prod-reports"

# Security
ENCRYPTION_KEY="32-character-encryption-key-prod"
JWT_SECRET="jwt-secret-for-internal-tokens"

# Rate Limiting
UPSTASH_REDIS_URL="redis://..."

# Application
NEXT_PUBLIC_APP_URL="https://app.appstoagents.com"
NODE_ENV="production"

# Monitoring
VERCEL_ANALYTICS_ID="..."
POSTHOG_API_KEY="..."
SENTRY_DSN="..."
```

---

## Deployment Process

### Automatic Deployment (Recommended)

**GitHub Integration Setup**:

1. **Connect Repository**:
   ```bash
   # Link Vercel project to GitHub
   vercel link
   vercel git connect
   ```

2. **Configure Branch Settings**:
   - **Production Branch**: `main`
   - **Preview Branches**: All other branches
   - **Automatic Deployments**: Enabled

3. **Build Settings**:
   ```json
   {
     "buildCommand": "npm run build",
     "outputDirectory": "dist",
     "installCommand": "npm ci",
     "devCommand": "npm run dev"
   }
   ```

**Deployment Workflow**:
1. Push code to feature branch → Preview deployment created
2. Create PR → Preview URL shared in PR
3. Merge to `main` → Production deployment triggered
4. Automatic domain update and cache invalidation

### Manual Deployment

```bash
# Install dependencies
npm ci

# Build application
npm run build

# Deploy to Vercel
vercel --prod

# Or deploy specific branch
vercel --prod --branch main
```

### Database Migration

```bash
# Run production migrations (use with caution)
npx prisma migrate deploy

# Generate production client
npx prisma generate

# Seed production data (initial setup only)
npx prisma db seed
```

---

## Infrastructure as Code (Optional)

### Terraform Configuration

```hcl
# terraform/main.tf
terraform {
  required_providers {
    vercel = {
      source = "vercel/vercel"
      version = "~> 0.15"
    }
    cloudflare = {
      source = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

# Vercel Project
resource "vercel_project" "ara" {
  name      = "appstoagents-ara"
  framework = "astro"
  
  git_repository = {
    type = "github"
    repo = "appstoagents/ara"
  }
  
  build_command = "npm run build"
  output_directory = "dist"
  install_command = "npm ci"
}

# Cloudflare R2 Bucket
resource "cloudflare_r2_bucket" "reports" {
  account_id = var.cloudflare_account_id
  name       = "ara-prod-reports"
  location   = "auto"
}

# Environment Variables
resource "vercel_project_environment_variable" "database_url" {
  project_id = vercel_project.ara.id
  key        = "DATABASE_URL"
  value      = var.database_url
  target     = ["production"]
  type       = "encrypted"
}
```

**Deploy Infrastructure**:
```bash
cd terraform
terraform init
terraform plan
terraform apply
```

---

## Production Database Setup

### Managed PostgreSQL with pgvector

**Option 1: Neon (Recommended)**
```bash
# Create production database
npx neonctl databases create ara_prod --name "ARA Production"

# Enable pgvector extension
psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Run migrations
npx prisma migrate deploy
```

**Option 2: Supabase**
```sql
-- Enable extensions in Supabase dashboard
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

**Option 3: AWS RDS**
```bash
# Install pgvector on RDS instance
# (Requires custom parameter group with shared_preload_libraries = 'vector')

# Connect and enable extension
psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### Database Performance Optimization

```sql
-- Production indexes for performance
CREATE INDEX CONCURRENTLY idx_audit_sessions_user_status 
ON audit_sessions(user_id, status) 
WHERE user_id IS NOT NULL;

CREATE INDEX CONCURRENTLY idx_chat_messages_session_recent 
ON chat_messages(audit_session_id, created_at DESC) 
WHERE created_at > NOW() - INTERVAL '30 days';

-- Vector search optimization
CREATE INDEX CONCURRENTLY chat_messages_embedding_cosine_idx 
ON chat_messages 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- Analyze tables for query planner
ANALYZE audit_sessions;
ANALYZE chat_messages;
ANALYZE audit_answers;
```

---

## Monitoring & Observability

### Vercel Analytics

Enable in Vercel dashboard:
- **Web Analytics**: Page views, performance metrics
- **Audience Analytics**: User behavior tracking
- **Speed Insights**: Core Web Vitals monitoring

### Custom Monitoring Setup

```typescript
// src/lib/monitoring.ts
import { trace } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/auto-instrumentations-node';

// Initialize OpenTelemetry
const sdk = new NodeSDK({
  serviceName: 'ara-api',
  traceExporter: new Vercel VercelTraceExporter(),
  metricExporter: new VercelMetricsExporter(),
});

sdk.start();

// Custom metrics
export function trackEvent(name: string, properties: Record<string, any>) {
  if (typeof window !== 'undefined' && window.posthog) {
    window.posthog.capture(name, properties);
  }
}

// Performance monitoring
export function withPerformanceTracking<T>(
  operationName: string,
  fn: () => Promise<T>
): Promise<T> {
  const span = trace.getActiveTracer().startSpan(operationName);
  const start = performance.now();
  
  return fn()
    .then(result => {
      span.setStatus({ code: 1 }); // OK
      span.setAttributes({
        'operation.duration': performance.now() - start,
        'operation.success': true
      });
      return result;
    })
    .catch(error => {
      span.setStatus({ code: 2, message: error.message }); // ERROR
      span.recordException(error);
      throw error;
    })
    .finally(() => {
      span.end();
    });
}
```

### Health Check Endpoints

```typescript
// src/pages/api/health.ts
export default async function handler(req: NextRequest) {
  try {
    // Database check
    await db.$queryRaw`SELECT 1`;
    
    // External services check
    const checks = await Promise.allSettled([
      fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` }
      }),
      fetch(`https://api.clerk.dev/v1/users?limit=1`, {
        headers: { 'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}` }
      })
    ]);
    
    return Response.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'healthy',
        openai: checks[0].status === 'fulfilled' ? 'healthy' : 'unhealthy',
        clerk: checks[1].status === 'fulfilled' ? 'healthy' : 'unhealthy'
      }
    });
  } catch (error) {
    return Response.json({
      status: 'unhealthy',
      error: error.message
    }, { status: 503 });
  }
}
```

---

## Security Configuration

### Domain & SSL Setup

```bash
# Add custom domain
vercel domains add app.appstoagents.com

# Configure DNS (Cloudflare example)
# A record: @ -> 76.76.19.61
# CNAME record: www -> app.appstoagents.com.cdn.vercel-dns.com
```

### Security Headers

```typescript
// vercel.json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=31536000; includeSubDomains; preload"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline' *.clerk.accounts.dev; style-src 'self' 'unsafe-inline'"
        }
      ]
    }
  ]
}
```

### Rate Limiting Configuration

```typescript
// src/middleware.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, '1 h'), // 100 requests per hour
});

export async function middleware(request: NextRequest) {
  const ip = request.ip ?? '127.0.0.1';
  const { success, pending, limit, reset, remaining } = await ratelimit.limit(ip);
  
  if (!success) {
    return new Response('Rate limit exceeded', {
      status: 429,
      headers: {
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': reset.toString()
      }
    });
  }
  
  return NextResponse.next();
}
```

---

## Backup & Recovery

### Database Backup

```bash
# Automated daily backups (cron job)
#!/bin/bash
# backup-db.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="ara_backup_${DATE}.sql"

# Create backup
pg_dump $DATABASE_URL > $BACKUP_FILE

# Upload to R2
aws s3 cp $BACKUP_FILE s3://ara-backups/ --endpoint-url https://your-account-id.r2.cloudflarestorage.com

# Clean up old backups (keep 30 days)
find . -name "ara_backup_*.sql" -mtime +30 -delete

echo "Backup completed: $BACKUP_FILE"
```

### Application Backup

```bash
# Backup Vercel project configuration
vercel env ls > vercel-env-backup.txt
vercel project ls > vercel-projects-backup.txt

# Export Clerk configuration
clerk-cli export users > clerk-users-backup.json
```

### Recovery Procedures

**Database Recovery**:
```bash
# Restore from backup
psql $DATABASE_URL < ara_backup_20250720_120000.sql

# Run migrations to latest version
npx prisma migrate deploy
```

**Application Recovery**:
```bash
# Redeploy from last known good commit
git checkout <last-good-commit>
vercel --prod

# Or rollback via Vercel dashboard
vercel rollback
```

---

## Performance Optimization

### Edge Function Optimization

```typescript
// Optimize Edge function cold starts
export const config = {
  runtime: 'edge',
  regions: ['iad1', 'sfo1'], // Specific regions for better performance
};

// Connection pooling for database
import { Pool } from '@neondatabase/serverless';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10, // Maximum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});
```

### Caching Strategy

```typescript
// API response caching
export default async function handler(req: NextRequest) {
  const cacheKey = `wizard-config-v1`;
  
  // Try Redis cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return Response.json(JSON.parse(cached), {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
      }
    });
  }
  
  // Fetch and cache
  const config = await getWizardConfig();
  await redis.setex(cacheKey, 3600, JSON.stringify(config));
  
  return Response.json(config, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
    }
  });
}
```

### Database Query Optimization

```sql
-- Monitor slow queries
SELECT 
  query,
  mean_exec_time,
  calls,
  total_exec_time
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;

-- Index usage analysis
SELECT 
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation
FROM pg_stats 
WHERE tablename = 'audit_sessions';
```

---

## Scaling Considerations

### Horizontal Scaling

**Database Scaling**:
- Read replicas for read-heavy operations
- Connection pooling with PgBouncer
- Query optimization and indexing

**Application Scaling**:
- Vercel automatically scales Edge functions
- Consider dedicated instances for high-traffic
- CDN optimization for static assets

### Monitoring Thresholds

```yaml
# alerts.yml
alerts:
  - name: "High Error Rate"
    condition: "error_rate > 5%"
    duration: "5m"
    action: "notify_team"
    
  - name: "High Response Time"
    condition: "p95_response_time > 2s"
    duration: "5m"
    action: "investigate"
    
  - name: "Database Connections"
    condition: "db_connections > 80%"
    duration: "2m"
    action: "scale_db"
```

---

## Troubleshooting

### Common Issues

**Edge Function Timeouts**:
```bash
# Check function logs
vercel logs --follow

# Increase timeout (max 30s for Edge)
export const config = {
  maxDuration: 30
};
```

**Database Connection Issues**:
```bash
# Test database connectivity
npx prisma db pull

# Check connection pool
SELECT * FROM pg_stat_activity WHERE datname = 'ara_prod';
```

**Rate Limiting Issues**:
```bash
# Check Redis connection
redis-cli -u $UPSTASH_REDIS_URL ping

# Reset rate limits
redis-cli -u $UPSTASH_REDIS_URL FLUSHDB
```

### Emergency Procedures

**Incident Response**:
1. **Assess Impact**: Check monitoring dashboards
2. **Communicate**: Update status page, notify stakeholders
3. **Mitigate**: Rollback, scale, or redirect traffic
4. **Fix**: Address root cause
5. **Document**: Post-incident review

**Rollback Procedure**:
```bash
# Quick rollback via Vercel
vercel rollback

# Or deploy specific commit
git checkout <previous-good-commit>
vercel --prod

# Database rollback (if needed)
psql $DATABASE_URL < backup-before-issue.sql
```

---

## Maintenance

### Regular Maintenance Tasks

**Weekly**:
- Review performance metrics
- Check error logs and fix issues
- Update dependencies (security patches)
- Backup verification

**Monthly**:
- Database maintenance (VACUUM, ANALYZE)
- Review and rotate API keys
- Capacity planning review
- Security audit

**Quarterly**:
- Dependency updates (major versions)
- Infrastructure cost optimization
- Disaster recovery testing
- Performance optimization review

### Update Procedures

```bash
# Update dependencies
npm update
npm audit fix

# Deploy updates
git add package*.json
git commit -m "chore: update dependencies"
git push origin main

# Monitor deployment
vercel logs --follow
```

---

*This deployment guide provides comprehensive procedures for production deployment and ongoing operations of the ARA application. Follow these procedures carefully and always test changes in preview environments before production deployment.*