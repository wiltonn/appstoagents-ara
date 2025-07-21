# Development Environment Configuration
# Terraform variables for development environment

environment = "dev"
project_name = "ara-system"

# Provider Configuration (replace with actual values)
vercel_team_id = "team_dev_id_here"
upstash_email = "dev@yourcompany.com"
planetscale_organization = "your-org-dev"
cloudflare_account_id = "your_cloudflare_account_id"

# Development-specific settings
# - Smaller resource allocations
# - Shorter retention periods
# - Relaxed security for testing