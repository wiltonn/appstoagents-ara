# Monitoring Module - Vercel Analytics and logging
# Manages monitoring and observability infrastructure for the ARA system

terraform {
  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 0.15"
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

variable "vercel_team_id" {
  description = "Vercel team ID"
  type        = string
}

variable "tags" {
  description = "Resource tags"
  type        = map(string)
  default     = {}
}

# Data source for project
data "vercel_project" "ara_project" {
  name = "${var.project_name}-${var.environment}"
}

# Vercel Analytics
resource "vercel_project_environment_variable" "analytics_enabled" {
  project_id = data.vercel_project.ara_project.id
  key        = "VERCEL_ANALYTICS_ENABLED"
  value      = var.environment == "prod" ? "true" : "false"
  target     = ["production", "preview", "development"]
}

# Speed Insights
resource "vercel_project_environment_variable" "speed_insights_enabled" {
  project_id = data.vercel_project.ara_project.id
  key        = "VERCEL_SPEED_INSIGHTS_ENABLED"
  value      = "true"
  target     = ["production", "preview", "development"]
}

# OpenTelemetry Configuration
resource "vercel_project_environment_variable" "otel_service_name" {
  project_id = data.vercel_project.ara_project.id
  key        = "OTEL_SERVICE_NAME"
  value      = "${var.project_name}-${var.environment}"
  target     = ["production", "preview", "development"]
}

resource "vercel_project_environment_variable" "otel_service_version" {
  project_id = data.vercel_project.ara_project.id
  key        = "OTEL_SERVICE_VERSION"
  value      = "1.0.0"
  target     = ["production", "preview", "development"]
}

resource "vercel_project_environment_variable" "otel_environment" {
  project_id = data.vercel_project.ara_project.id
  key        = "OTEL_ENVIRONMENT"
  value      = var.environment
  target     = ["production", "preview", "development"]
}

# Logging Configuration
resource "vercel_project_environment_variable" "log_level" {
  project_id = data.vercel_project.ara_project.id
  key        = "LOG_LEVEL"
  value      = var.environment == "prod" ? "info" : "debug"
  target     = ["production", "preview", "development"]
}

resource "vercel_project_environment_variable" "log_format" {
  project_id = data.vercel_project.ara_project.id
  key        = "LOG_FORMAT"
  value      = "json"
  target     = ["production", "preview", "development"]
}

# Error Tracking Configuration (if using external service)
resource "vercel_project_environment_variable" "sentry_dsn" {
  count      = var.environment == "prod" ? 1 : 0
  project_id = data.vercel_project.ara_project.id
  key        = "SENTRY_DSN"
  value      = "https://your-sentry-dsn@sentry.io/project-id"
  target     = ["production"]
  sensitive  = true
}

resource "vercel_project_environment_variable" "sentry_environment" {
  count      = var.environment == "prod" ? 1 : 0
  project_id = data.vercel_project.ara_project.id
  key        = "SENTRY_ENVIRONMENT"
  value      = var.environment
  target     = ["production"]
}

# Health Check Configuration
resource "vercel_project_environment_variable" "health_check_enabled" {
  project_id = data.vercel_project.ara_project.id
  key        = "HEALTH_CHECK_ENABLED"
  value      = "true"
  target     = ["production", "preview", "development"]
}

resource "vercel_project_environment_variable" "health_check_interval" {
  project_id = data.vercel_project.ara_project.id
  key        = "HEALTH_CHECK_INTERVAL"
  value      = var.environment == "prod" ? "30" : "60"
  target     = ["production", "preview", "development"]
}

# Performance Monitoring
resource "vercel_project_environment_variable" "performance_monitoring" {
  project_id = data.vercel_project.ara_project.id
  key        = "PERFORMANCE_MONITORING_ENABLED"
  value      = "true"
  target     = ["production", "preview", "development"]
}

resource "vercel_project_environment_variable" "performance_sample_rate" {
  project_id = data.vercel_project.ara_project.id
  key        = "PERFORMANCE_SAMPLE_RATE"
  value      = var.environment == "prod" ? "0.1" : "1.0"
  target     = ["production", "preview", "development"]
}

# Alerts Configuration
resource "vercel_project_environment_variable" "alerts_enabled" {
  project_id = data.vercel_project.ara_project.id
  key        = "ALERTS_ENABLED"
  value      = var.environment == "prod" ? "true" : "false"
  target     = ["production", "preview", "development"]
}

resource "vercel_project_environment_variable" "alert_webhook_url" {
  count      = var.environment == "prod" ? 1 : 0
  project_id = data.vercel_project.ara_project.id
  key        = "ALERT_WEBHOOK_URL"
  value      = "https://hooks.slack.com/services/your/slack/webhook"
  target     = ["production"]
  sensitive  = true
}

# Metrics Collection
resource "vercel_project_environment_variable" "metrics_enabled" {
  project_id = data.vercel_project.ara_project.id
  key        = "METRICS_ENABLED"
  value      = "true"
  target     = ["production", "preview", "development"]
}

resource "vercel_project_environment_variable" "metrics_endpoint" {
  project_id = data.vercel_project.ara_project.id
  key        = "METRICS_ENDPOINT"
  value      = "/api/metrics"
  target     = ["production", "preview", "development"]
}

# Database Monitoring
resource "vercel_project_environment_variable" "db_monitoring_enabled" {
  project_id = data.vercel_project.ara_project.id
  key        = "DATABASE_MONITORING_ENABLED"
  value      = "true"
  target     = ["production", "preview", "development"]
}

resource "vercel_project_environment_variable" "db_slow_query_threshold" {
  project_id = data.vercel_project.ara_project.id
  key        = "DATABASE_SLOW_QUERY_THRESHOLD"
  value      = "1000" # milliseconds
  target     = ["production", "preview", "development"]
}

# Cache Monitoring
resource "vercel_project_environment_variable" "cache_monitoring_enabled" {
  project_id = data.vercel_project.ara_project.id
  key        = "CACHE_MONITORING_ENABLED"
  value      = "true"
  target     = ["production", "preview", "development"]
}

# API Rate Limiting Monitoring
resource "vercel_project_environment_variable" "rate_limit_monitoring" {
  project_id = data.vercel_project.ara_project.id
  key        = "RATE_LIMIT_MONITORING_ENABLED"
  value      = "true"
  target     = ["production", "preview", "development"]
}

# User Analytics (Privacy-compliant)
resource "vercel_project_environment_variable" "user_analytics_enabled" {
  project_id = data.vercel_project.ara_project.id
  key        = "USER_ANALYTICS_ENABLED"
  value      = var.environment == "prod" ? "true" : "false"
  target     = ["production", "preview", "development"]
}

resource "vercel_project_environment_variable" "analytics_privacy_mode" {
  project_id = data.vercel_project.ara_project.id
  key        = "ANALYTICS_PRIVACY_MODE"
  value      = "strict"
  target     = ["production", "preview", "development"]
}

# Outputs
output "monitoring_config" {
  description = "Monitoring configuration"
  value = {
    analytics_enabled     = var.environment == "prod" ? true : false
    speed_insights       = true
    performance_monitoring = true
    health_checks        = true
    alerts_enabled       = var.environment == "prod" ? true : false
    log_level           = var.environment == "prod" ? "info" : "debug"
  }
}

output "otel_config" {
  description = "OpenTelemetry configuration"
  value = {
    service_name    = "${var.project_name}-${var.environment}"
    service_version = "1.0.0"
    environment     = var.environment
    sample_rate     = var.environment == "prod" ? 0.1 : 1.0
  }
}

output "endpoints" {
  description = "Monitoring endpoints"
  value = {
    health_check = "/api/health"
    metrics      = "/api/metrics"
    status       = "/api/status"
  }
}