# Redis Module - Upstash Redis for caching and sessions
# Manages Redis infrastructure for the ARA system

terraform {
  required_providers {
    upstash = {
      source  = "upstash/upstash"
      version = "~> 1.0"
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

variable "email" {
  description = "Upstash account email"
  type        = string
}

variable "tags" {
  description = "Resource tags"
  type        = map(string)
  default     = {}
}

# Redis Database
resource "upstash_redis_database" "ara_redis" {
  database_name = "${var.project_name}-${var.environment}"
  region        = "us-east-1"
  tls           = true
  
  # Environment-specific sizing
  consistent = var.environment == "prod" ? true : false
  
  # Multi-zone for production
  multizone = var.environment == "prod" ? true : false
}

# Backup configuration (production only)
resource "upstash_redis_database" "ara_redis_backup" {
  count         = var.environment == "prod" ? 1 : 0
  database_name = "${var.project_name}-${var.environment}-backup"
  region        = "us-west-1" # Different region for DR
  tls           = true
  consistent    = true
  multizone     = true
}

# Locals for connection string construction
locals {
  connection_string = "redis://:${upstash_redis_database.ara_redis.password}@${upstash_redis_database.ara_redis.endpoint}:${upstash_redis_database.ara_redis.port}"
  
  rest_url = "https://${upstash_redis_database.ara_redis.rest_token}@${upstash_redis_database.ara_redis.endpoint}"
}

# Outputs
output "database_id" {
  description = "Redis database ID"
  value       = upstash_redis_database.ara_redis.database_id
}

output "endpoint" {
  description = "Redis endpoint"
  value       = upstash_redis_database.ara_redis.endpoint
}

output "port" {
  description = "Redis port"
  value       = upstash_redis_database.ara_redis.port
}

output "password" {
  description = "Redis password"
  value       = upstash_redis_database.ara_redis.password
  sensitive   = true
}

output "connection_string" {
  description = "Redis connection string"
  value       = local.connection_string
  sensitive   = true
}

output "rest_url" {
  description = "Redis REST URL"
  value       = local.rest_url
  sensitive   = true
}

output "rest_token" {
  description = "Redis REST token"
  value       = upstash_redis_database.ara_redis.rest_token
  sensitive   = true
}

output "connection_details" {
  description = "Redis connection details"
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

output "backup_details" {
  description = "Backup Redis details (production only)"
  value = var.environment == "prod" ? {
    endpoint   = upstash_redis_database.ara_redis_backup[0].endpoint
    port       = upstash_redis_database.ara_redis_backup[0].port
    password   = upstash_redis_database.ara_redis_backup[0].password
    region     = "us-west-1"
    multizone  = true
  } : null
  sensitive = true
}