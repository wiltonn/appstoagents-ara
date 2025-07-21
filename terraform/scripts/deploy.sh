#!/bin/bash
# Terraform Deployment Script - Task 4.3: Infrastructure as Code
# Automated infrastructure deployment for ARA system

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="$(dirname "$SCRIPT_DIR")"
ENVIRONMENTS_DIR="$TERRAFORM_DIR/environments"

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
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

# Usage function
usage() {
    cat << EOF
Usage: $0 [OPTIONS] ENVIRONMENT ACTION

Environments:
    development  Deploy to development environment
    staging      Deploy to staging environment
    production   Deploy to production environment

Actions:
    plan         Create and show execution plan
    apply        Apply the Terraform configuration
    destroy      Destroy the infrastructure
    validate     Validate the Terraform configuration
    output       Show output values
    refresh      Refresh the state
    import       Import existing resources

Options:
    -h, --help           Show this help message
    -v, --verbose        Enable verbose output
    -d, --dry-run        Show what would be done without executing
    -f, --force          Force apply without confirmation (use with caution)
    --var-file FILE      Specify additional variable file
    --target RESOURCE    Target specific resource
    --auto-approve       Automatically approve apply/destroy

Examples:
    $0 development plan
    $0 staging apply
    $0 production plan --var-file=custom.tfvars
    $0 production destroy --target=module.database

Environment Variables:
    TF_VAR_*            Terraform variables
    TF_LOG              Terraform log level (TRACE, DEBUG, INFO, WARN, ERROR)
    AWS_PROFILE         AWS profile for state backend

EOF
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if terraform is installed
    if ! command -v terraform &> /dev/null; then
        log_error "Terraform is not installed. Please install Terraform first."
        exit 1
    fi
    
    # Check terraform version
    local tf_version
    tf_version=$(terraform version -json | jq -r '.terraform_version')
    log_info "Terraform version: $tf_version"
    
    # Check if jq is installed
    if ! command -v jq &> /dev/null; then
        log_warning "jq is not installed. Some features may not work properly."
    fi
    
    log_success "Prerequisites check completed"
}

# Validate environment
validate_environment() {
    local env="$1"
    
    case "$env" in
        development|dev)
            ENV="development"
            ;;
        staging|stage)
            ENV="staging"
            ;;
        production|prod)
            ENV="production"
            ;;
        *)
            log_error "Invalid environment: $env"
            log_error "Valid environments: development, staging, production"
            exit 1
            ;;
    esac
    
    # Check if environment directory exists
    if [[ ! -d "$ENVIRONMENTS_DIR/$ENV" ]]; then
        log_error "Environment directory not found: $ENVIRONMENTS_DIR/$ENV"
        exit 1
    fi
    
    log_info "Environment: $ENV"
}

# Setup terraform workspace
setup_workspace() {
    local env="$1"
    
    log_info "Setting up Terraform workspace for $env..."
    
    # Change to terraform directory
    cd "$TERRAFORM_DIR"
    
    # Initialize terraform
    log_info "Initializing Terraform..."
    terraform init
    
    # Select or create workspace
    if terraform workspace list | grep -q "$env"; then
        log_info "Selecting workspace: $env"
        terraform workspace select "$env"
    else
        log_info "Creating workspace: $env"
        terraform workspace new "$env"
    fi
    
    log_success "Workspace setup completed"
}

# Validate terraform configuration
validate_terraform() {
    log_info "Validating Terraform configuration..."
    
    if terraform validate; then
        log_success "Terraform configuration is valid"
    else
        log_error "Terraform configuration validation failed"
        exit 1
    fi
}

# Plan terraform changes
plan_terraform() {
    local env="$1"
    shift
    local additional_args=("$@")
    
    log_info "Creating Terraform plan for $env environment..."
    
    local var_file="$ENVIRONMENTS_DIR/$env/terraform.tfvars"
    local plan_file="$ENVIRONMENTS_DIR/$env/terraform.tfplan"
    
    # Check if var file exists
    if [[ ! -f "$var_file" ]]; then
        log_warning "Variable file not found: $var_file"
        log_warning "Using example file. Please copy and customize it."
        var_file="$ENVIRONMENTS_DIR/$env/terraform.tfvars.example"
    fi
    
    # Run terraform plan
    terraform plan \
        -var-file="$var_file" \
        -out="$plan_file" \
        "${additional_args[@]}" || {
        log_error "Terraform plan failed"
        exit 1
    }
    
    log_success "Terraform plan created successfully"
    log_info "Plan saved to: $plan_file"
}

# Apply terraform changes
apply_terraform() {
    local env="$1"
    shift
    local additional_args=("$@")
    
    log_info "Applying Terraform configuration for $env environment..."
    
    local plan_file="$ENVIRONMENTS_DIR/$env/terraform.tfplan"
    
    # Check if plan file exists
    if [[ ! -f "$plan_file" ]]; then
        log_error "Plan file not found: $plan_file"
        log_error "Please run 'plan' action first"
        exit 1
    fi
    
    # Confirmation for production
    if [[ "$env" == "production" ]] && [[ ! " ${additional_args[*]} " =~ " --auto-approve " ]]; then
        log_warning "You are about to apply changes to PRODUCTION environment!"
        echo -n "Are you sure? (type 'yes' to confirm): "
        read -r confirmation
        if [[ "$confirmation" != "yes" ]]; then
            log_info "Deployment cancelled"
            exit 0
        fi
    fi
    
    # Apply the plan
    terraform apply "$plan_file" || {
        log_error "Terraform apply failed"
        exit 1
    }
    
    log_success "Terraform apply completed successfully"
    
    # Clean up plan file
    rm -f "$plan_file"
    
    # Show outputs
    log_info "Infrastructure outputs:"
    terraform output
}

# Destroy terraform infrastructure
destroy_terraform() {
    local env="$1"
    shift
    local additional_args=("$@")
    
    log_warning "Destroying Terraform infrastructure for $env environment..."
    
    local var_file="$ENVIRONMENTS_DIR/$env/terraform.tfvars"
    
    # Check if var file exists
    if [[ ! -f "$var_file" ]]; then
        log_warning "Variable file not found: $var_file"
        var_file="$ENVIRONMENTS_DIR/$env/terraform.tfvars.example"
    fi
    
    # Multiple confirmations for production
    if [[ "$env" == "production" ]]; then
        log_error "WARNING: You are about to DESTROY the PRODUCTION environment!"
        log_error "This action is IRREVERSIBLE and will delete all infrastructure!"
        echo -n "Type 'DESTROY PRODUCTION' to confirm: "
        read -r confirmation
        if [[ "$confirmation" != "DESTROY PRODUCTION" ]]; then
            log_info "Destruction cancelled"
            exit 0
        fi
        
        echo -n "Are you absolutely sure? (type 'yes' to confirm): "
        read -r final_confirmation
        if [[ "$final_confirmation" != "yes" ]]; then
            log_info "Destruction cancelled"
            exit 0
        fi
    fi
    
    # Destroy infrastructure
    terraform destroy \
        -var-file="$var_file" \
        "${additional_args[@]}" || {
        log_error "Terraform destroy failed"
        exit 1
    }
    
    log_success "Infrastructure destroyed successfully"
}

# Show terraform outputs
show_outputs() {
    log_info "Terraform outputs:"
    terraform output
}

# Refresh terraform state
refresh_state() {
    local env="$1"
    
    log_info "Refreshing Terraform state for $env environment..."
    
    local var_file="$ENVIRONMENTS_DIR/$env/terraform.tfvars"
    
    if [[ ! -f "$var_file" ]]; then
        var_file="$ENVIRONMENTS_DIR/$env/terraform.tfvars.example"
    fi
    
    terraform refresh -var-file="$var_file"
    
    log_success "State refreshed successfully"
}

# Main function
main() {
    local verbose=false
    local dry_run=false
    local force=false
    local var_files=()
    local target=""
    local auto_approve=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                usage
                exit 0
                ;;
            -v|--verbose)
                verbose=true
                export TF_LOG="INFO"
                shift
                ;;
            -d|--dry-run)
                dry_run=true
                shift
                ;;
            -f|--force)
                force=true
                shift
                ;;
            --var-file)
                var_files+=("$2")
                shift 2
                ;;
            --target)
                target="-target=$2"
                shift 2
                ;;
            --auto-approve)
                auto_approve=true
                shift
                ;;
            -*)
                log_error "Unknown option: $1"
                usage
                exit 1
                ;;
            *)
                break
                ;;
        esac
    done
    
    # Check required arguments
    if [[ $# -lt 2 ]]; then
        log_error "Missing required arguments"
        usage
        exit 1
    fi
    
    local environment="$1"
    local action="$2"
    shift 2
    
    # Additional arguments for terraform commands
    local additional_args=("$@")
    
    # Add common arguments
    if [[ -n "$target" ]]; then
        additional_args+=("$target")
    fi
    
    if [[ "$auto_approve" == true ]]; then
        additional_args+=("--auto-approve")
    fi
    
    # Add custom var files
    for var_file in "${var_files[@]}"; do
        additional_args+=("-var-file=$var_file")
    done
    
    # Enable verbose mode
    if [[ "$verbose" == true ]]; then
        set -x
    fi
    
    # Dry run mode
    if [[ "$dry_run" == true ]]; then
        log_info "DRY RUN MODE - No changes will be made"
        log_info "Would execute: $0 $environment $action ${additional_args[*]}"
        exit 0
    fi
    
    # Validate inputs
    validate_environment "$environment"
    
    # Check prerequisites
    check_prerequisites
    
    # Setup workspace
    setup_workspace "$ENV"
    
    # Validate configuration
    validate_terraform
    
    # Execute action
    case "$action" in
        plan)
            plan_terraform "$ENV" "${additional_args[@]}"
            ;;
        apply)
            apply_terraform "$ENV" "${additional_args[@]}"
            ;;
        destroy)
            destroy_terraform "$ENV" "${additional_args[@]}"
            ;;
        validate)
            log_success "Terraform configuration validated successfully"
            ;;
        output)
            show_outputs
            ;;
        refresh)
            refresh_state "$ENV"
            ;;
        import)
            log_error "Import action requires manual implementation"
            exit 1
            ;;
        *)
            log_error "Invalid action: $action"
            log_error "Valid actions: plan, apply, destroy, validate, output, refresh, import"
            exit 1
            ;;
    esac
    
    log_success "Operation completed successfully"
}

# Run main function with all arguments
main "$@"