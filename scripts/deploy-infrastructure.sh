#!/bin/bash

# ARA System Infrastructure Deployment Script
# Deploys infrastructure using Terraform across environments

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TERRAFORM_DIR="$PROJECT_ROOT/terraform"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Help function
show_help() {
    cat << EOF
ARA System Infrastructure Deployment Script

Usage: $0 [OPTIONS] ENVIRONMENT

ENVIRONMENT:
    dev         Deploy to development environment
    staging     Deploy to staging environment
    prod        Deploy to production environment

OPTIONS:
    -p, --plan-only     Only run terraform plan (no apply)
    -d, --destroy       Destroy infrastructure (USE WITH CAUTION)
    -f, --force         Skip confirmation prompts
    -v, --verbose       Enable verbose output
    -h, --help          Show this help message

EXAMPLES:
    $0 dev                    # Deploy to development
    $0 staging --plan-only    # Plan staging deployment
    $0 prod                   # Deploy to production (with confirmation)
    $0 dev --destroy --force  # Destroy dev environment

PREREQUISITES:
    - Terraform >= 1.0 installed
    - AWS CLI configured (for state backend)
    - Provider API tokens set as environment variables:
      * VERCEL_API_TOKEN
      * UPSTASH_API_KEY
      * PLANETSCALE_ACCESS_TOKEN
      * CLOUDFLARE_API_TOKEN

EOF
}

# Parse command line arguments
ENVIRONMENT=""
PLAN_ONLY=false
DESTROY=false
FORCE=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--plan-only)
            PLAN_ONLY=true
            shift
            ;;
        -d|--destroy)
            DESTROY=true
            shift
            ;;
        -f|--force)
            FORCE=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        dev|staging|prod)
            ENVIRONMENT="$1"
            shift
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Validate environment
if [[ -z "$ENVIRONMENT" ]]; then
    log_error "Environment is required"
    show_help
    exit 1
fi

if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
    log_error "Invalid environment: $ENVIRONMENT. Must be dev, staging, or prod"
    exit 1
fi

# Enable verbose mode
if [[ "$VERBOSE" == true ]]; then
    set -x
fi

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Terraform
    if ! command -v terraform &> /dev/null; then
        log_error "Terraform is not installed or not in PATH"
        exit 1
    fi
    
    local tf_version
    tf_version=$(terraform version -json | jq -r '.terraform_version')
    log_info "Terraform version: $tf_version"
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed or not in PATH"
        exit 1
    fi
    
    # Check required environment variables
    local required_vars=(
        "VERCEL_API_TOKEN"
        "UPSTASH_API_KEY" 
        "PLANETSCALE_ACCESS_TOKEN"
        "CLOUDFLARE_API_TOKEN"
    )
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            log_error "Required environment variable $var is not set"
            exit 1
        fi
    done
    
    # Check terraform files exist
    if [[ ! -f "$TERRAFORM_DIR/main.tf" ]]; then
        log_error "Terraform configuration not found at $TERRAFORM_DIR/main.tf"
        exit 1
    fi
    
    local tfvars_file="$TERRAFORM_DIR/environments/$ENVIRONMENT/terraform.tfvars"
    if [[ ! -f "$tfvars_file" ]]; then
        log_error "Terraform variables file not found at $tfvars_file"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Initialize Terraform backend
init_terraform() {
    log_info "Initializing Terraform..."
    
    cd "$TERRAFORM_DIR"
    
    # Initialize with backend configuration
    terraform init \
        -backend-config="bucket=ara-terraform-state" \
        -backend-config="key=infrastructure/$ENVIRONMENT/terraform.tfstate" \
        -backend-config="region=us-east-1" \
        -backend-config="encrypt=true" \
        -backend-config="dynamodb_table=ara-terraform-locks"
    
    log_success "Terraform initialized"
}

# Validate Terraform configuration
validate_terraform() {
    log_info "Validating Terraform configuration..."
    
    cd "$TERRAFORM_DIR"
    
    # Format check
    if ! terraform fmt -check -recursive; then
        log_warning "Terraform files are not properly formatted"
        if [[ "$FORCE" == false ]]; then
            read -p "Do you want to format them automatically? (y/n): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                terraform fmt -recursive
                log_success "Files formatted"
            fi
        else
            terraform fmt -recursive
            log_success "Files formatted automatically"
        fi
    fi
    
    # Validate configuration
    terraform validate
    
    log_success "Terraform configuration is valid"
}

# Plan infrastructure changes
plan_infrastructure() {
    log_info "Planning infrastructure changes for $ENVIRONMENT..."
    
    cd "$TERRAFORM_DIR"
    
    local tfvars_file="environments/$ENVIRONMENT/terraform.tfvars"
    local plan_file="terraform-$ENVIRONMENT.plan"
    
    # Run terraform plan
    terraform plan \
        -var-file="$tfvars_file" \
        -out="$plan_file" \
        -detailed-exitcode
    
    local plan_exit_code=$?
    
    case $plan_exit_code in
        0)
            log_success "No changes detected"
            return 0
            ;;
        1)
            log_error "Terraform plan failed"
            return 1
            ;;
        2)
            log_success "Changes detected and plan saved to $plan_file"
            return 2
            ;;
    esac
}

# Apply infrastructure changes
apply_infrastructure() {
    log_info "Applying infrastructure changes for $ENVIRONMENT..."
    
    cd "$TERRAFORM_DIR"
    
    local plan_file="terraform-$ENVIRONMENT.plan"
    
    if [[ ! -f "$plan_file" ]]; then
        log_error "Plan file not found. Run plan first."
        return 1
    fi
    
    # Production deployment confirmation
    if [[ "$ENVIRONMENT" == "prod" && "$FORCE" == false ]]; then
        log_warning "You are about to deploy to PRODUCTION environment"
        read -p "Are you sure you want to continue? (yes/no): " -r
        if [[ ! $REPLY =~ ^yes$ ]]; then
            log_info "Deployment cancelled"
            return 0
        fi
    fi
    
    # Apply the plan
    terraform apply "$plan_file"
    
    log_success "Infrastructure deployment completed for $ENVIRONMENT"
    
    # Show outputs
    log_info "Deployment outputs:"
    terraform output
}

# Destroy infrastructure
destroy_infrastructure() {
    log_error "DESTRUCTIVE OPERATION: Destroying infrastructure for $ENVIRONMENT"
    
    if [[ "$FORCE" == false ]]; then
        log_warning "This will permanently delete all resources in the $ENVIRONMENT environment"
        read -p "Type 'destroy-$ENVIRONMENT' to confirm: " -r
        if [[ "$REPLY" != "destroy-$ENVIRONMENT" ]]; then
            log_info "Destruction cancelled"
            return 0
        fi
    fi
    
    cd "$TERRAFORM_DIR"
    
    local tfvars_file="environments/$ENVIRONMENT/terraform.tfvars"
    
    terraform destroy \
        -var-file="$tfvars_file" \
        -auto-approve
    
    log_success "Infrastructure destroyed for $ENVIRONMENT"
}

# Post-deployment validation
validate_deployment() {
    log_info "Validating deployment..."
    
    cd "$TERRAFORM_DIR"
    
    # Get outputs
    local project_url
    project_url=$(terraform output -raw project_url 2>/dev/null || echo "")
    
    if [[ -n "$project_url" ]]; then
        log_info "Testing health endpoint: $project_url/api/health"
        
        # Wait a moment for deployment to stabilize
        sleep 10
        
        # Test health endpoint
        if curl -sf "$project_url/api/health" > /dev/null; then
            log_success "Health check passed"
        else
            log_warning "Health check failed - deployment may still be initializing"
        fi
    else
        log_warning "Could not determine project URL for health check"
    fi
}

# Cleanup function
cleanup() {
    local exit_code=$?
    
    # Clean up plan files
    cd "$TERRAFORM_DIR" 2>/dev/null || true
    rm -f terraform-*.plan
    
    if [[ $exit_code -eq 0 ]]; then
        log_success "Deployment script completed successfully"
    else
        log_error "Deployment script failed with exit code $exit_code"
    fi
    
    exit $exit_code
}

# Set up cleanup trap
trap cleanup EXIT

# Main execution
main() {
    log_info "Starting ARA infrastructure deployment for $ENVIRONMENT environment"
    
    check_prerequisites
    init_terraform
    validate_terraform
    
    if [[ "$DESTROY" == true ]]; then
        destroy_infrastructure
        return 0
    fi
    
    # Plan infrastructure
    plan_infrastructure
    local plan_exit_code=$?
    
    if [[ $plan_exit_code -eq 1 ]]; then
        log_error "Planning failed"
        return 1
    elif [[ $plan_exit_code -eq 0 ]]; then
        log_info "No changes to apply"
        return 0
    fi
    
    # Apply if not plan-only mode
    if [[ "$PLAN_ONLY" == false ]]; then
        apply_infrastructure
        validate_deployment
    else
        log_info "Plan-only mode: skipping apply"
    fi
}

# Run main function
main "$@"