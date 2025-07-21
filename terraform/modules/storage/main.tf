# Storage Module - Cloudflare R2 for PDF reports
# Manages object storage infrastructure for the ARA system

terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

# Variables
variable "environment" {
  description = "Environment name"
  type        = string
}

variable "project_name" {
  description = "Project name"
  type        = string
}

variable "account_id" {
  description = "Cloudflare account ID"
  type        = string
}

variable "tags" {
  description = "Resource tags"
  type        = map(string)
  default     = {}
}

# R2 Bucket for PDF reports
resource "cloudflare_r2_bucket" "ara_reports" {
  account_id = var.account_id
  name       = "${var.project_name}-reports-${var.environment}"
  location   = "ENAM" # Eastern North America
}

# CORS configuration for direct uploads
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

# API Token for R2 access
resource "cloudflare_api_token" "r2_token" {
  name = "${var.project_name}-r2-${var.environment}"
  
  policy {
    permission_groups = [
      "c8fed203ed3043cba015a93ad1616f1f", # R2:Read
      "6ac7b055e8a24a4e99a9b9e8a5e9e5a7", # R2:Write
    ]
    
    resources = {
      "com.cloudflare.api.account.${var.account_id}" = "*"
      "com.cloudflare.api.account.zone.*" = "*"
    }
  }
  
  condition {
    request_ip {
      in = ["0.0.0.0/0"] # Allow from anywhere (restrict in production)
    }
  }
  
  expires_on = "2025-12-31T23:59:59Z"
}

# Worker for signed URL generation
resource "cloudflare_worker_script" "signed_url_generator" {
  account_id = var.account_id
  name       = "${var.project_name}-signed-urls-${var.environment}"
  content    = file("${path.module}/worker.js")
  
  secret_text_binding {
    name = "R2_ACCESS_KEY_ID"
    text = cloudflare_api_token.r2_token.value
  }
  
  secret_text_binding {
    name = "R2_SECRET_ACCESS_KEY"
    text = cloudflare_api_token.r2_token.value
  }
  
  r2_bucket_binding {
    name        = "REPORTS_BUCKET"
    bucket_name = cloudflare_r2_bucket.ara_reports.name
  }
}

# Route for the worker
resource "cloudflare_worker_route" "signed_url_route" {
  zone_id     = var.account_id
  pattern     = "api.${var.environment == "prod" ? "yourdomain.com" : "${var.environment}.yourdomain.com"}/r2/*"
  script_name = cloudflare_worker_script.signed_url_generator.name
}

# Custom domain for R2 bucket (production only)
resource "cloudflare_r2_bucket" "ara_reports_custom_domain" {
  count      = var.environment == "prod" ? 1 : 0
  account_id = var.account_id
  name       = cloudflare_r2_bucket.ara_reports.name
  location   = cloudflare_r2_bucket.ara_reports.location
}

# Outputs
output "bucket_name" {
  description = "R2 bucket name"
  value       = cloudflare_r2_bucket.ara_reports.name
}

output "bucket_endpoint" {
  description = "R2 bucket endpoint"
  value       = "https://${var.account_id}.r2.cloudflarestorage.com"
}

output "r2_endpoint" {
  description = "R2 API endpoint"
  value       = "https://${var.account_id}.r2.cloudflarestorage.com"
}

output "api_token" {
  description = "R2 API token"
  value       = cloudflare_api_token.r2_token.value
  sensitive   = true
}

output "worker_url" {
  description = "Signed URL generator worker URL"
  value       = "https://api.${var.environment == "prod" ? "yourdomain.com" : "${var.environment}.yourdomain.com"}/r2"
}

output "storage_details" {
  description = "Storage configuration details"
  value = {
    bucket_name    = cloudflare_r2_bucket.ara_reports.name
    endpoint       = "https://${var.account_id}.r2.cloudflarestorage.com"
    worker_url     = "https://api.${var.environment == "prod" ? "yourdomain.com" : "${var.environment}.yourdomain.com"}/r2"
    region         = "ENAM"
    retention_days = var.environment == "prod" ? 365 : 30
  }
}