# Additional Monitoring and Alerting Configuration
# External monitoring services and alerting setup

# Uptime monitoring (using external service)
resource "vercel_project_environment_variable" "uptime_monitor_enabled" {
  project_id = vercel_project.ara_system.id
  key        = "UPTIME_MONITORING_ENABLED"
  value      = var.environment == "prod" ? "true" : "false"
  target     = ["production", "preview", "development"]
}

# Health check endpoints configuration
resource "vercel_project_environment_variable" "health_endpoints" {
  project_id = vercel_project.ara_system.id
  key        = "HEALTH_CHECK_ENDPOINTS"
  value      = jsonencode([
    "/api/health",
    "/api/health/database",
    "/api/health/redis",
    "/api/health/storage"
  ])
  target     = ["production", "preview", "development"]
}

# Performance monitoring thresholds
resource "vercel_project_environment_variable" "perf_thresholds" {
  project_id = vercel_project.ara_system.id
  key        = "PERFORMANCE_THRESHOLDS"
  value      = jsonencode({
    response_time_p95 = var.environment == "prod" ? 500 : 1000
    error_rate_max    = var.environment == "prod" ? 0.01 : 0.05
    memory_usage_max  = 0.8
    cpu_usage_max     = 0.7
  })
  target     = ["production", "preview", "development"]
}

# Alert channels configuration
resource "vercel_project_environment_variable" "alert_channels" {
  count      = var.environment == "prod" ? 1 : 0
  project_id = vercel_project.ara_system.id
  key        = "ALERT_CHANNELS"
  value      = jsonencode({
    slack_webhook    = "https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"
    email_recipients = ["ops@yourcompany.com", "dev@yourcompany.com"]
    pagerduty_key    = "your_pagerduty_integration_key"
  })
  target     = ["production"]
  sensitive  = true
}

# Database monitoring configuration
resource "vercel_project_environment_variable" "db_alert_config" {
  project_id = vercel_project.ara_system.id
  key        = "DATABASE_MONITORING_CONFIG"
  value      = jsonencode({
    slow_query_threshold    = 1000  # milliseconds
    connection_pool_warning = 80    # percentage
    error_rate_alert       = 0.05  # 5%
    backup_check_interval  = 86400 # 24 hours
  })
  target     = ["production", "preview", "development"]
}

# Redis monitoring configuration
resource "vercel_project_environment_variable" "redis_alert_config" {
  project_id = vercel_project.ara_system.id
  key        = "REDIS_MONITORING_CONFIG"
  value      = jsonencode({
    memory_usage_warning = 75     # percentage
    memory_usage_critical = 90    # percentage
    hit_rate_warning     = 80     # percentage
    connection_timeout   = 5000   # milliseconds
  })
  target     = ["production", "preview", "development"]
}

# Business metrics monitoring
resource "vercel_project_environment_variable" "business_metrics_config" {
  project_id = vercel_project.ara_system.id
  key        = "BUSINESS_METRICS_CONFIG"
  value      = jsonencode({
    track_user_sessions    = true
    track_wizard_completion = true
    track_pdf_generation   = true
    track_chat_usage      = true
    privacy_compliant     = true
  })
  target     = ["production", "preview", "development"]
}

# Log aggregation configuration
resource "vercel_project_environment_variable" "log_config" {
  project_id = vercel_project.ara_system.id
  key        = "LOGGING_CONFIG"
  value      = jsonencode({
    level           = var.environment == "prod" ? "info" : "debug"
    format          = "json"
    include_request_id = true
    include_user_id = false  # Privacy
    retention_days  = var.environment == "prod" ? 30 : 7
  })
  target     = ["production", "preview", "development"]
}

# Security monitoring
resource "vercel_project_environment_variable" "security_monitoring" {
  project_id = vercel_project.ara_system.id
  key        = "SECURITY_MONITORING_CONFIG"
  value      = jsonencode({
    rate_limit_alerts      = true
    failed_auth_threshold  = 5     # attempts per minute
    suspicious_ip_tracking = var.environment == "prod"
    security_headers_check = true
  })
  target     = ["production", "preview", "development"]
}

# Cost monitoring (production only)
resource "vercel_project_environment_variable" "cost_monitoring" {
  count      = var.environment == "prod" ? 1 : 0
  project_id = vercel_project.ara_system.id
  key        = "COST_MONITORING_CONFIG"
  value      = jsonencode({
    monthly_budget_alert = 500    # USD
    daily_usage_threshold = 20    # USD
    services_to_monitor = [
      "vercel",
      "planetscale", 
      "upstash",
      "cloudflare"
    ]
  })
  target     = ["production"]
}

# Deployment monitoring
resource "vercel_project_environment_variable" "deployment_monitoring" {
  project_id = vercel_project.ara_system.id
  key        = "DEPLOYMENT_MONITORING_CONFIG"
  value      = jsonencode({
    post_deploy_health_check = true
    rollback_on_health_fail  = var.environment == "prod"
    deployment_timeout       = 600  # seconds
    health_check_retries     = 3
  })
  target     = ["production", "preview", "development"]
}