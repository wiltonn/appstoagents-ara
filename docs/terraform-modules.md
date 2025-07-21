# Terraform Modules Documentation

**Version**: 1.0.0  
**Last Updated**: January 21, 2025  
**Target Audience**: Infrastructure Engineers, DevOps Teams

---

## 📦 Module Overview

The ARA system infrastructure is built using modular Terraform configurations that promote reusability, maintainability, and consistency across environments. Each module encapsulates a specific infrastructure concern and can be used independently or as part of the larger system.

---

## 🏗️ Module Architecture

```
terraform/modules/
├── database/          # PlanetScale database management
├── storage/           # Cloudflare R2 object storage
├── redis/             # Upstash Redis caching
└── monitoring/        # Observability and alerting
```

### Design Principles
- **Single Responsibility**: Each module handles one infrastructure concern
- **Reusability**: Modules work across multiple environments
- **Composability**: Modules can be combined to build complex systems
- **Parameterization**: Flexible configuration through variables
- **Output Consistency**: Standardized outputs for integration

---

## 🗄️ Database Module

**Location**: `terraform/modules/database/`  
**Purpose**: Manages PlanetScale MySQL database with vector capabilities

### Features
- **Multi-Environment Support**: Development, staging, and production configurations
- **Branch Management**: Database branches for schema evolution
- **Connection Management**: Secure connection string generation
- **Backup Configuration**: Automated backup setup for production
- **Performance Optimization**: Appropriate cluster sizing per environment

### Input Variables

```hcl
variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "ara-system"
}

variable "organization" {
  description = "PlanetScale organization name"
  type        = string
  sensitive   = true
}

variable "tags" {
  description = "Resource tags for organization"
  type        = map(string)
  default     = {}
}
```

### Resource Configuration

#### Database Instance
```hcl
resource "planetscale_database" "ara_db" {
  organization = var.organization
  name         = "${var.project_name}-${var.environment}"
  region       = "us-east"
  
  # Environment-specific sizing
  cluster_size = var.environment == "prod" ? "PS-40" : "PS-10"
}
```

#### Branch Management
```hcl
# Main branch for production
resource "planetscale_branch" "main_branch" {
  count        = var.environment != "prod" ? 1 : 0
  organization = var.organization
  database     = planetscale_database.ara_db.name
  name         = "main"
}

# Development branch for schema changes
resource "planetscale_branch" "dev_branch" {
  count        = var.environment == "dev" ? 1 : 0
  organization = var.organization
  database     = planetscale_database.ara_db.name
  name         = "development"
}
```

#### Connection Management
```hcl
resource "planetscale_password" "ara_db_password" {
  organization = var.organization
  database     = planetscale_database.ara_db.name
  branch       = local.branch_name
  name         = "${var.environment}-app-password"
  role         = "readwriter"
}
```

### Outputs

```hcl
output "database_id" {
  description = "PlanetScale database identifier"
  value       = planetscale_database.ara_db.id
}

output "connection_string" {
  description = "Database connection string for applications"
  value       = local.connection_string
  sensitive   = true
}

output "connection_details" {
  description = "Detailed connection information"
  value = {
    host     = planetscale_database.ara_db.host
    database = planetscale_database.ara_db.name
    username = planetscale_password.ara_db_password.username
    password = planetscale_password.ara_db_password.plain_text
    region   = planetscale_database.ara_db.region
    branch   = local.branch_name
  }
  sensitive = true
}
```

### Usage Example

```hcl
module "database" {
  source = "./modules/database"
  
  environment   = "production"
  project_name  = "ara-system"
  organization  = "your-planetscale-org"
  
  tags = {
    Environment = "production"
    Project     = "ara-system"
    ManagedBy   = "terraform"
  }
}
```

---

## 📦 Storage Module

**Location**: `terraform/modules/storage/`  
**Purpose**: Manages Cloudflare R2 object storage for PDF reports

### Features
- **Secure Access**: Signed URL generation through Cloudflare Worker
- **Lifecycle Management**: Automated cleanup of old files
- **Global CDN**: Fast access worldwide through Cloudflare's network
- **Cost Optimization**: Intelligent storage tiering
- **CORS Configuration**: Direct browser uploads

### Input Variables

```hcl
variable "environment" {
  description = "Environment name"
  type        = string
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "account_id" {
  description = "Cloudflare account ID"
  type        = string
  sensitive   = true
}

variable "tags" {
  description = "Resource tags"
  type        = map(string)
  default     = {}
}
```

### Resource Configuration

#### R2 Bucket
```hcl
resource "cloudflare_r2_bucket" "ara_reports" {
  account_id = var.account_id
  name       = "${var.project_name}-reports-${var.environment}"
  location   = "ENAM" # Eastern North America
}
```

#### Lifecycle Management
```hcl
resource "cloudflare_r2_bucket" "ara_reports_cors" {
  account_id = var.account_id
  name       = cloudflare_r2_bucket.ara_reports.name
  location   = cloudflare_r2_bucket.ara_reports.location
  
  lifecycle_rule {
    id      = "delete_old_reports"
    enabled = true
    
    filter {
      prefix = "reports/"
    }
    
    expiration {
      days = var.environment == "prod" ? 365 : 30
    }
  }
  
  lifecycle_rule {
    id      = "abort_incomplete_uploads"
    enabled = true
    
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}
```

#### Cloudflare Worker
```hcl
resource "cloudflare_worker_script" "signed_url_generator" {
  account_id = var.account_id
  name       = "${var.project_name}-signed-urls-${var.environment}"
  content    = file("${path.module}/worker.js")
  
  secret_text_binding {
    name = "R2_ACCESS_KEY_ID"
    text = cloudflare_api_token.r2_token.value
  }
  
  r2_bucket_binding {
    name        = "REPORTS_BUCKET"
    bucket_name = cloudflare_r2_bucket.ara_reports.name
  }
}
```

### Worker Implementation

The module includes a Cloudflare Worker (`worker.js`) that provides secure access to R2:

```javascript
// Key functions
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const operation = url.pathname.split('/')[2];
    
    switch (operation) {
      case 'upload':   return handleUpload(request, env);
      case 'download': return handleDownload(request, env);
      case 'delete':   return handleDelete(request, env);
    }
  }
}

// Generate presigned upload URL
async function handleUpload(request, env) {
  const { filename, sessionId } = await request.json();
  const key = `reports/${new Date().toISOString().slice(0, 10)}/${sessionId}/${filename}`;
  
  const signedUrl = await env.REPORTS_BUCKET.createPresignedUrl('PUT', key, {
    expiresIn: 86400, // 24 hours
    contentType: 'application/pdf'
  });
  
  return new Response(JSON.stringify({ uploadUrl: signedUrl, key }));
}
```

### Outputs

```hcl
output "bucket_name" {
  description = "R2 bucket name"
  value       = cloudflare_r2_bucket.ara_reports.name
}

output "api_token" {
  description = "R2 API token for application access"
  value       = cloudflare_api_token.r2_token.value
  sensitive   = true
}

output "worker_url" {
  description = "Signed URL generator worker endpoint"
  value       = "https://api.${local.domain}/r2"
}

output "storage_details" {
  description = "Complete storage configuration"
  value = {
    bucket_name    = cloudflare_r2_bucket.ara_reports.name
    endpoint       = "https://${var.account_id}.r2.cloudflarestorage.com"
    worker_url     = "https://api.${local.domain}/r2"
    region         = "ENAM"
    retention_days = var.environment == "prod" ? 365 : 30
  }
}
```

---

## 🗃️ Redis Module

**Location**: `terraform/modules/redis/`  
**Purpose**: Manages Upstash Redis for caching and session storage

### Features
- **High Availability**: Multi-zone setup for production
- **Global Distribution**: Edge locations for low latency
- **Backup & Recovery**: Automated backup to different regions
- **TLS Encryption**: Secure connections by default
- **Cost Optimization**: Environment-appropriate sizing

### Input Variables

```hcl
variable "environment" {
  description = "Environment name"
  type        = string
}

variable "project_name" {
  description = "Project name"
  type        = string
}

variable "email" {
  description = "Upstash account email"
  type        = string
  sensitive   = true
}

variable "tags" {
  description = "Resource tags"
  type        = map(string)
  default     = {}
}
```

### Resource Configuration

#### Primary Redis Instance
```hcl
resource "upstash_redis_database" "ara_redis" {
  database_name = "${var.project_name}-${var.environment}"
  region        = "us-east-1"
  tls           = true
  
  # Environment-specific configuration
  consistent = var.environment == "prod" ? true : false
  multizone  = var.environment == "prod" ? true : false
}
```

#### Backup Configuration (Production)
```hcl
resource "upstash_redis_database" "ara_redis_backup" {
  count         = var.environment == "prod" ? 1 : 0
  database_name = "${var.project_name}-${var.environment}-backup"
  region        = "us-west-1" # Different region for DR
  tls           = true
  consistent    = true
  multizone     = true
}
```

### Connection String Generation
```hcl
locals {
  connection_string = "redis://:${upstash_redis_database.ara_redis.password}@${upstash_redis_database.ara_redis.endpoint}:${upstash_redis_database.ara_redis.port}"
  rest_url = "https://${upstash_redis_database.ara_redis.rest_token}@${upstash_redis_database.ara_redis.endpoint}"
}
```

### Outputs

```hcl
output "connection_string" {
  description = "Redis connection string for applications"
  value       = local.connection_string
  sensitive   = true
}

output "rest_url" {
  description = "Redis REST API URL for serverless functions"
  value       = local.rest_url
  sensitive   = true
}

output "connection_details" {
  description = "Complete Redis connection information"
  value = {
    endpoint     = upstash_redis_database.ara_redis.endpoint
    port         = upstash_redis_database.ara_redis.port
    password     = upstash_redis_database.ara_redis.password
    rest_url     = local.rest_url
    rest_token   = upstash_redis_database.ara_redis.rest_token
    tls_enabled  = true
    region       = "us-east-1"
    multizone    = var.environment == "prod" ? true : false
  }
  sensitive = true
}
```

---

## 📊 Monitoring Module

**Location**: `terraform/modules/monitoring/`  
**Purpose**: Configures observability, monitoring, and alerting

### Features
- **Application Analytics**: Vercel Analytics integration
- **Performance Monitoring**: Core Web Vitals tracking
- **Error Tracking**: Structured error logging
- **Health Checks**: Multi-endpoint monitoring
- **Alerting**: Slack and email notifications

### Input Variables

```hcl
variable "environment" {
  description = "Environment name"
  type        = string
}

variable "project_name" {
  description = "Project name"
  type        = string
}

variable "vercel_team_id" {
  description = "Vercel team ID for project access"
  type        = string
  sensitive   = true
}

variable "tags" {
  description = "Resource tags"
  type        = map(string)
  default     = {}
}
```

### Configuration Categories

#### Analytics Configuration
```hcl
resource "vercel_project_environment_variable" "analytics_enabled" {
  project_id = data.vercel_project.ara_project.id
  key        = "VERCEL_ANALYTICS_ENABLED"
  value      = var.environment == "prod" ? "true" : "false"
  target     = ["production", "preview", "development"]
}

resource "vercel_project_environment_variable" "speed_insights_enabled" {
  project_id = data.vercel_project.ara_project.id
  key        = "VERCEL_SPEED_INSIGHTS_ENABLED"
  value      = "true"
  target     = ["production", "preview", "development"]
}
```

#### OpenTelemetry Setup
```hcl
resource "vercel_project_environment_variable" "otel_service_name" {
  project_id = data.vercel_project.ara_project.id
  key        = "OTEL_SERVICE_NAME"
  value      = "${var.project_name}-${var.environment}"
  target     = ["production", "preview", "development"]
}

resource "vercel_project_environment_variable" "otel_environment" {
  project_id = data.vercel_project.ara_project.id
  key        = "OTEL_ENVIRONMENT"
  value      = var.environment
  target     = ["production", "preview", "development"]
}
```

#### Performance Monitoring
```hcl
resource "vercel_project_environment_variable" "perf_thresholds" {
  project_id = data.vercel_project.ara_project.id
  key        = "PERFORMANCE_THRESHOLDS"
  value      = jsonencode({
    response_time_p95 = var.environment == "prod" ? 500 : 1000
    error_rate_max    = var.environment == "prod" ? 0.01 : 0.05
    memory_usage_max  = 0.8
    cpu_usage_max     = 0.7
  })
  target     = ["production", "preview", "development"]
}
```

#### Health Check Configuration
```hcl
resource "vercel_project_environment_variable" "health_endpoints" {
  project_id = data.vercel_project.ara_project.id
  key        = "HEALTH_CHECK_ENDPOINTS"
  value      = jsonencode([
    "/api/health",
    "/api/health/database",
    "/api/health/redis",
    "/api/health/storage"
  ])
  target     = ["production", "preview", "development"]
}
```

### Outputs

```hcl
output "monitoring_config" {
  description = "Monitoring configuration summary"
  value = {
    analytics_enabled      = var.environment == "prod" ? true : false
    speed_insights        = true
    performance_monitoring = true
    health_checks         = true
    alerts_enabled        = var.environment == "prod" ? true : false
    log_level            = var.environment == "prod" ? "info" : "debug"
  }
}

output "endpoints" {
  description = "Monitoring endpoint URLs"
  value = {
    health_check = "/api/health"
    metrics      = "/api/metrics"
    status       = "/api/status"
  }
}
```

---

## 🔧 Module Usage Patterns

### Single Environment Deployment
```hcl
# Deploy to staging environment
module "database" {
  source = "./modules/database"
  
  environment  = "staging"
  project_name = "ara-system"
  organization = var.planetscale_organization
  
  tags = local.common_tags
}

module "redis" {
  source = "./modules/redis"
  
  environment  = "staging"
  project_name = "ara-system"
  email        = var.upstash_email
  
  tags = local.common_tags
}
```

### Multi-Environment with Workspace
```hcl
# Use Terraform workspaces for environment isolation
terraform {
  backend "s3" {
    bucket = "ara-terraform-state"
    key    = "infrastructure/terraform.tfstate"
    region = "us-east-1"
  }
}

locals {
  environment = terraform.workspace
  common_tags = {
    Environment = local.environment
    Project     = "ara-system"
    ManagedBy   = "terraform"
  }
}
```

### Module Composition
```hcl
# Complete infrastructure composition
module "database" {
  source = "./modules/database"
  # ... configuration
}

module "redis" {
  source = "./modules/redis"
  # ... configuration
}

module "storage" {
  source = "./modules/storage"
  # ... configuration
}

module "monitoring" {
  source = "./modules/monitoring"
  # ... configuration
  
  # Pass outputs from other modules
  depends_on = [
    module.database,
    module.redis,
    module.storage
  ]
}
```

---

## 🧪 Testing Modules

### Module Validation
```bash
# Validate module syntax
terraform init
terraform validate

# Check formatting
terraform fmt -check -recursive

# Plan without applying
terraform plan -var-file="test.tfvars"
```

### Integration Testing
```bash
# Test module in isolation
cd modules/database
terraform init
terraform plan -var="environment=test" -var="organization=test-org"

# Test module composition
terraform plan -var-file="environments/dev/terraform.tfvars"
```

### Automated Testing
```yaml
# GitHub Actions workflow
name: Terraform Module Tests
on:
  pull_request:
    paths: ['terraform/modules/**']

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: hashicorp/setup-terraform@v3
      - name: Terraform Format Check
        run: terraform fmt -check -recursive
      - name: Terraform Validate
        run: |
          for module in modules/*/; do
            cd "$module"
            terraform init
            terraform validate
            cd -
          done
```

---

## 📋 Best Practices

### Module Design
1. **Single Responsibility**: Each module manages one logical component
2. **Parameterization**: Use variables for all configurable values
3. **Output Consistency**: Provide consistent and useful outputs
4. **Documentation**: Include README and examples for each module
5. **Versioning**: Tag module versions for stability

### Security Practices
1. **Sensitive Variables**: Mark sensitive data appropriately
2. **Least Privilege**: Use minimal required permissions
3. **Secret Management**: Never hardcode secrets in modules
4. **Validation**: Validate input parameters
5. **Encryption**: Enable encryption by default

### Operational Practices
1. **State Management**: Use remote state with locking
2. **Environment Isolation**: Separate state per environment
3. **Backup Strategy**: Regular state backups
4. **Change Management**: Use plan/apply workflow
5. **Monitoring**: Monitor infrastructure changes

---

## 🐛 Troubleshooting

### Common Issues

#### Module Path Errors
```bash
# Issue: Module not found
Error: Module not found: ./modules/database

# Solution: Check relative paths
module "database" {
  source = "./modules/database"  # Correct
  # source = "modules/database"  # Incorrect
}
```

#### Variable Type Mismatches
```bash
# Issue: Variable type mismatch
Error: Invalid value for variable "tags"

# Solution: Check variable types
variable "tags" {
  type = map(string)  # Ensure correct type
}
```

#### Resource Dependencies
```bash
# Issue: Resource creation order
Error: Resource depends on non-existent resource

# Solution: Use explicit dependencies
depends_on = [module.database]
```

### Debug Commands
```bash
# View module structure
terraform graph | dot -Tpng > graph.png

# Show module outputs
terraform output

# Inspect state
terraform show
terraform state list
```

---

*This module documentation provides comprehensive guidance for understanding, using, and maintaining the Terraform modules in the ARA system infrastructure.*