# ARA System Infrastructure as Code
# Main Terraform configuration for Agent Readiness Audit system

terraform {
  required_version = ">= 1.0"
  
  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 0.15"
    }
    upstash = {
      source  = "upstash/upstash"
      version = "~> 1.0"
    }
    planetscale = {
      source  = "planetscale/planetscale"
      version = "~> 0.6"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }

  # Remote state backend
  backend "s3" {
    bucket         = "ara-terraform-state"
    key            = "infrastructure/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "ara-terraform-locks"
  }
}

# Variables
variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "ara-system"
}

variable "vercel_team_id" {
  description = "Vercel team ID"
  type        = string
  sensitive   = true
}

variable "upstash_email" {
  description = "Upstash account email"
  type        = string
  sensitive   = true
}

variable "planetscale_organization" {
  description = "PlanetScale organization name"
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare account ID"
  type        = string
  sensitive   = true
}

# Data sources
data "vercel_project_directory" "ara_system" {
  path = "../"
}

# Locals
locals {
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Component   = "ara-system"
  }
  
  domain_mapping = {
    dev     = "ara-dev.vercel.app"
    staging = "ara-staging.vercel.app" 
    prod    = "ara.yourdomain.com"
  }
}

# Vercel Project
resource "vercel_project" "ara_system" {
  name      = "${var.project_name}-${var.environment}"
  framework = "astro"
  
  build_command    = "npm run build"
  output_directory = "dist"
  install_command  = "npm install"
  
  environment = [
    {
      key    = "NODE_ENV"
      value  = var.environment == "prod" ? "production" : "development"
      target = ["production", "preview", "development"]
    },
    {
      key    = "NEXT_PUBLIC_APP_URL"
      value  = "https://${local.domain_mapping[var.environment]}"
      target = ["production", "preview", "development"]
    }
  ]

  git_repository = {
    type = "github"
    repo = "your-org/appstoagents-ara"
  }
}

# Database Module
module "database" {
  source = "./modules/database"
  
  environment         = var.environment
  project_name        = var.project_name
  organization        = var.planetscale_organization
  
  tags = local.common_tags
}

# Storage Module  
module "storage" {
  source = "./modules/storage"
  
  environment  = var.environment
  project_name = var.project_name
  account_id   = var.cloudflare_account_id
  
  tags = local.common_tags
}

# Redis Module
module "redis" {
  source = "./modules/redis"
  
  environment  = var.environment
  project_name = var.project_name
  email        = var.upstash_email
  
  tags = local.common_tags
}

# Monitoring Module
module "monitoring" {
  source = "./modules/monitoring"
  
  environment    = var.environment
  project_name   = var.project_name
  vercel_team_id = var.vercel_team_id
  
  tags = local.common_tags
}

# Vercel Environment Variables
resource "vercel_project_environment_variable" "database_url" {
  project_id = vercel_project.ara_system.id
  key        = "DATABASE_URL"
  value      = module.database.connection_string
  target     = ["production", "preview", "development"]
  sensitive  = true
}

resource "vercel_project_environment_variable" "direct_url" {
  project_id = vercel_project.ara_system.id
  key        = "DIRECT_URL"
  value      = module.database.direct_connection_string
  target     = ["production", "preview", "development"]
  sensitive  = true
}

resource "vercel_project_environment_variable" "redis_url" {
  project_id = vercel_project.ara_system.id
  key        = "REDIS_URL"
  value      = module.redis.connection_string
  target     = ["production", "preview", "development"]
  sensitive  = true
}

resource "vercel_project_environment_variable" "r2_endpoint" {
  project_id = vercel_project.ara_system.id
  key        = "R2_ENDPOINT"
  value      = module.storage.r2_endpoint
  target     = ["production", "preview", "development"]
}

resource "vercel_project_environment_variable" "r2_bucket" {
  project_id = vercel_project.ara_system.id
  key        = "R2_BUCKET_NAME"
  value      = module.storage.bucket_name
  target     = ["production", "preview", "development"]
}

# Custom Domain (Production only)
resource "vercel_project_domain" "ara_custom_domain" {
  count      = var.environment == "prod" ? 1 : 0
  project_id = vercel_project.ara_system.id
  domain     = "ara.yourdomain.com"
}

# Outputs
output "vercel_project_id" {
  description = "Vercel project ID"
  value       = vercel_project.ara_system.id
}

output "project_url" {
  description = "Project URL"
  value       = "https://${local.domain_mapping[var.environment]}"
}

output "database_connection" {
  description = "Database connection details"
  value       = module.database.connection_details
  sensitive   = true
}

output "redis_connection" {
  description = "Redis connection details"
  value       = module.redis.connection_details
  sensitive   = true
}

output "storage_details" {
  description = "Storage configuration"
  value       = module.storage.storage_details
}