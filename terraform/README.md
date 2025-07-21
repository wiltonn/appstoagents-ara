# ARA System Infrastructure as Code

This directory contains Terraform configurations for managing the Agent Readiness Audit (ARA) system infrastructure across multiple environments.

## 🏗️ Infrastructure Overview

### Technology Stack
- **Hosting**: Vercel Edge Runtime
- **Database**: PlanetScale (MySQL with pgvector-like capabilities)
- **Cache**: Upstash Redis
- **Storage**: Cloudflare R2
- **Monitoring**: Vercel Analytics + OpenTelemetry
- **DNS**: Cloudflare

### Environments
- **Development** (`dev`): Development and testing
- **Staging** (`staging`): Pre-production validation
- **Production** (`prod`): Live production system

## 📁 Directory Structure

```
terraform/
├── main.tf                    # Main Terraform configuration
├── modules/                   # Reusable infrastructure modules
│   ├── database/             # PlanetScale database module
│   ├── storage/              # Cloudflare R2 storage module
│   ├── redis/                # Upstash Redis module
│   └── monitoring/           # Monitoring and observability
├── environments/             # Environment-specific configurations
│   ├── dev/
│   ├── staging/
│   └── prod/
└── README.md                 # This file
```

## 🚀 Getting Started

### Prerequisites

1. **Install Terraform** (>= 1.0)
   ```bash
   # macOS
   brew install terraform
   
   # Or download from https://terraform.io/downloads
   ```

2. **Configure Provider Authentication**
   ```bash
   # Vercel
   export VERCEL_API_TOKEN="your_vercel_token"
   
   # Upstash
   export UPSTASH_API_KEY="your_upstash_api_key"
   
   # PlanetScale
   export PLANETSCALE_ACCESS_TOKEN="your_planetscale_token"
   
   # Cloudflare
   export CLOUDFLARE_API_TOKEN="your_cloudflare_token"
   ```

3. **AWS CLI** (for state backend)
   ```bash
   aws configure
   ```

### Initial Setup

1. **Initialize Terraform Backend**
   ```bash
   # Create S3 bucket for state (one-time setup)
   aws s3 mb s3://ara-terraform-state
   
   # Create DynamoDB table for state locking
   aws dynamodb create-table \
     --table-name ara-terraform-locks \
     --attribute-definitions AttributeName=LockID,AttributeType=S \
     --key-schema AttributeName=LockID,KeyType=HASH \
     --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5
   ```

2. **Configure Environment Variables**
   ```bash
   # Copy and edit environment-specific variables
   cp terraform/environments/dev/terraform.tfvars.example terraform/environments/dev/terraform.tfvars
   
   # Edit with your actual values
   vim terraform/environments/dev/terraform.tfvars
   ```

## 🛠️ Usage

### Deploy to Development

```bash
# Initialize Terraform
terraform init

# Plan deployment
terraform plan -var-file="environments/dev/terraform.tfvars"

# Apply changes
terraform apply -var-file="environments/dev/terraform.tfvars"
```

### Deploy to Staging

```bash
# Plan staging deployment
terraform plan -var-file="environments/staging/terraform.tfvars"

# Apply to staging
terraform apply -var-file="environments/staging/terraform.tfvars"
```

### Deploy to Production

```bash
# Plan production deployment
terraform plan -var-file="environments/prod/terraform.tfvars"

# Apply to production (requires approval)
terraform apply -var-file="environments/prod/terraform.tfvars"
```

### Common Operations

```bash
# View current state
terraform show

# List resources
terraform state list

# Get outputs
terraform output

# Destroy environment (caution!)
terraform destroy -var-file="environments/dev/terraform.tfvars"

# Format configuration files
terraform fmt -recursive

# Validate configuration
terraform validate
```

## 📋 Module Documentation

### Database Module (`modules/database`)

Manages PlanetScale database infrastructure:
- Database creation and configuration
- Branch management for development
- Connection string generation
- Backup configuration (production)

**Outputs:**
- `database_id`: Database identifier
- `connection_string`: Application connection string
- `connection_details`: Full connection information

### Storage Module (`modules/storage`)

Manages Cloudflare R2 object storage:
- R2 bucket creation and configuration
- CORS and lifecycle policies
- Signed URL generation worker
- Custom domain setup (production)

**Outputs:**
- `bucket_name`: R2 bucket name
- `api_token`: R2 access token
- `worker_url`: Signed URL generator endpoint

### Redis Module (`modules/redis`)

Manages Upstash Redis infrastructure:
- Redis database creation
- Environment-specific sizing
- Multi-zone setup (production)
- Backup configuration

**Outputs:**
- `connection_string`: Redis connection string
- `rest_url`: Redis REST API URL
- `connection_details`: Full connection information

### Monitoring Module (`modules/monitoring`)

Configures monitoring and observability:
- Vercel Analytics setup
- OpenTelemetry configuration
- Logging and error tracking
- Health checks and alerts

**Outputs:**
- `monitoring_config`: Monitoring settings
- `endpoints`: Health check endpoints

## 🔧 Configuration

### Environment Variables

Each environment requires the following variables:

```hcl
# terraform.tfvars
environment = "dev|staging|prod"
project_name = "ara-system"

# Provider credentials
vercel_team_id = "your_vercel_team_id"
upstash_email = "your_upstash_email"
planetscale_organization = "your_planetscale_org"
cloudflare_account_id = "your_cloudflare_account_id"
```

### Sensitive Variables

Store sensitive values in environment variables or use Terraform Cloud:

```bash
export TF_VAR_vercel_team_id="team_xxx"
export TF_VAR_upstash_email="user@example.com"
export TF_VAR_planetscale_organization="your-org"
export TF_VAR_cloudflare_account_id="account_id"
```

## 🔐 Security Best Practices

### Access Control
- Use least-privilege IAM policies
- Rotate API tokens regularly
- Enable MFA for provider accounts
- Store sensitive data in environment variables

### State Management
- Store Terraform state in encrypted S3 bucket
- Use DynamoDB for state locking
- Enable versioning on state bucket
- Restrict access to state files

### Resource Security
- Enable TLS for all connections
- Use secure passwords and tokens
- Configure proper CORS policies
- Enable audit logging

## 🚨 Disaster Recovery

### Backup Strategy
- Database: Automated backups in different region (production)
- Redis: Multi-zone setup with backup instance
- Storage: Cross-region replication enabled
- State: S3 versioning and cross-region replication

### Recovery Procedures

1. **Database Recovery**
   ```bash
   # Restore from backup
   pscale backup restore ara-system-prod backup-id
   ```

2. **Redis Recovery**
   ```bash
   # Failover to backup instance (production)
   terraform apply -replace=module.redis.upstash_redis_database.ara_redis
   ```

3. **Complete Environment Recovery**
   ```bash
   # Restore entire environment
   terraform apply -var-file="environments/prod/terraform.tfvars"
   ```

## 📊 Monitoring and Alerting

### Key Metrics
- Database connection count and query performance
- Redis hit rate and memory usage
- Storage usage and transfer costs
- Application response times and error rates

### Alert Thresholds
- Database response time > 500ms
- Redis memory usage > 80%
- Error rate > 1%
- Storage costs > monthly budget

### Dashboards
Access monitoring dashboards at:
- Vercel Analytics: https://vercel.com/your-team/analytics
- PlanetScale Insights: https://app.planetscale.com/your-org/insights
- Upstash Console: https://console.upstash.com
- Cloudflare Analytics: https://dash.cloudflare.com/analytics

## 🔄 CI/CD Integration

This infrastructure is automatically managed through GitHub Actions:

```yaml
# .github/workflows/terraform.yml
name: Terraform
on:
  push:
    paths: ['terraform/**']
  pull_request:
    paths: ['terraform/**']

jobs:
  terraform:
    runs-on: ubuntu-latest
    steps:
      - uses: hashicorp/setup-terraform@v2
      - run: terraform fmt -check
      - run: terraform validate
      - run: terraform plan
      - run: terraform apply # (on main branch)
```

## 🆘 Troubleshooting

### Common Issues

**Issue**: Terraform state lock
```bash
# Solution: Force unlock (use carefully)
terraform force-unlock LOCK_ID
```

**Issue**: Provider authentication
```bash
# Solution: Re-export credentials
export VERCEL_API_TOKEN="new_token"
terraform plan
```

**Issue**: Resource conflicts
```bash
# Solution: Import existing resources
terraform import module.database.planetscale_database.ara_db org/database-name
```

### Debug Mode
```bash
# Enable detailed logging
export TF_LOG=DEBUG
terraform apply
```

## 📞 Support

### Internal Support
- **Infrastructure Team**: #ara-infrastructure Slack channel
- **On-call Engineer**: Terraform issues and emergencies
- **Documentation**: Additional docs in `/docs/infrastructure/`

### External Resources
- [Terraform Documentation](https://terraform.io/docs)
- [Vercel Provider](https://registry.terraform.io/providers/vercel/vercel)
- [Upstash Provider](https://registry.terraform.io/providers/upstash/upstash)
- [PlanetScale Provider](https://registry.terraform.io/providers/planetscale/planetscale)
- [Cloudflare Provider](https://registry.terraform.io/providers/cloudflare/cloudflare)

---

*For questions or issues with this infrastructure, please contact the infrastructure team or create an issue in the project repository.*