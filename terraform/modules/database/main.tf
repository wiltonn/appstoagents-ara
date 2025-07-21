# Database Module - PlanetScale PostgreSQL with pgvector
# Manages database infrastructure for the ARA system

terraform {
  required_providers {
    planetscale = {
      source  = "planetscale/planetscale"
      version = "~> 0.6"
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

variable "organization" {
  description = "PlanetScale organization"
  type        = string
}

variable "tags" {
  description = "Resource tags"
  type        = map(string)
  default     = {}
}

# Database
resource "planetscale_database" "ara_db" {
  organization = var.organization
  name         = "${var.project_name}-${var.environment}"
  region       = "us-east"
  
  # Enable pgvector extension support
  cluster_size = var.environment == "prod" ? "PS-40" : "PS-10"
}

# Database Branch (for development/staging)
resource "planetscale_branch" "main_branch" {
  count        = var.environment != "prod" ? 1 : 0
  organization = var.organization
  database     = planetscale_database.ara_db.name
  name         = "main"
}

# Development Branch
resource "planetscale_branch" "dev_branch" {
  count        = var.environment == "dev" ? 1 : 0
  organization = var.organization
  database     = planetscale_database.ara_db.name
  name         = "development"
  
  depends_on = [planetscale_branch.main_branch]
}

# Database Password
resource "planetscale_password" "ara_db_password" {
  organization = var.organization
  database     = planetscale_database.ara_db.name
  branch       = var.environment == "prod" ? "main" : (var.environment == "dev" ? "development" : "main")
  name         = "${var.environment}-app-password"
  role         = "readwriter"
  
  depends_on = [
    planetscale_branch.main_branch,
    planetscale_branch.dev_branch
  ]
}

# Connection string construction
locals {
  connection_string = "mysql://${planetscale_password.ara_db_password.username}:${planetscale_password.ara_db_password.plain_text}@${planetscale_database.ara_db.host}/${planetscale_database.ara_db.name}?sslaccept=strict&sslcert=/etc/ssl/certs/ca-certificates.crt"
  
  direct_connection_string = "mysql://${planetscale_password.ara_db_password.username}:${planetscale_password.ara_db_password.plain_text}@${planetscale_database.ara_db.host}/${planetscale_database.ara_db.name}?sslaccept=strict&sslcert=/etc/ssl/certs/ca-certificates.crt"
}

# Outputs
output "database_id" {
  description = "Database ID"
  value       = planetscale_database.ara_db.id
}

output "database_name" {
  description = "Database name"
  value       = planetscale_database.ara_db.name
}

output "connection_string" {
  description = "Database connection string"
  value       = local.connection_string
  sensitive   = true
}

output "direct_connection_string" {
  description = "Direct database connection string"
  value       = local.direct_connection_string
  sensitive   = true
}

output "connection_details" {
  description = "Database connection details"
  value = {
    host     = planetscale_database.ara_db.host
    database = planetscale_database.ara_db.name
    username = planetscale_password.ara_db_password.username
    password = planetscale_password.ara_db_password.plain_text
    region   = planetscale_database.ara_db.region
  }
  sensitive = true
}

output "database_url" {
  description = "Database URL for applications"
  value       = local.connection_string
  sensitive   = true
}