#!/usr/bin/env bash

# Garden Planner Application Deployment Script
# Version: 1.0.0
# Requires: kubectl v1.24+, docker 20.10+

set -euo pipefail
IFS=$'\n\t'

# Global variables
readonly NAMESPACE="garden-planner"
readonly BACKEND_IMAGE="garden-planner/backend:latest"
readonly WEB_IMAGE="garden-planner/web:latest"
readonly DEPLOYMENT_TIMEOUT="300s"
readonly HEALTH_CHECK_INTERVAL="10s"
readonly ROLLBACK_TIMEOUT="180s"
readonly MIN_REPLICAS="2"
readonly MAX_REPLICAS="5"

# Color codes for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m'

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check deployment prerequisites
check_prerequisites() {
    log_info "Checking deployment prerequisites..."

    # Verify kubectl installation and version
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed"
        return 1
    fi

    local kubectl_version
    kubectl_version=$(kubectl version --client -o json | grep -o '"major":"[0-9]*","minor":"[0-9]*"' | head -1)
    if [[ ! $kubectl_version =~ "major":"1","minor":"2[4-9]" ]]; then
        log_error "kubectl version must be 1.24 or higher"
        return 1
    }

    # Verify cluster access
    if ! kubectl auth can-i create deployments --namespace="${NAMESPACE}" &> /dev/null; then
        log_error "Insufficient permissions to deploy to namespace ${NAMESPACE}"
        return 1
    }

    # Check for required configuration files
    local required_files=(
        "../kubernetes/backend-deployment.yaml"
        "../kubernetes/web-deployment.yaml"
        "../kubernetes/secrets.yaml"
    )

    for file in "${required_files[@]}"; do
        if [[ ! -f $file ]]; then
            log_error "Required configuration file not found: $file"
            return 1
        fi
    done

    # Verify Docker daemon
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running or accessible"
        return 1
    }

    log_info "Prerequisites check completed successfully"
    return 0
}

# Deploy backend service
deploy_backend() {
    log_info "Deploying backend service..."

    # Apply security context and configurations
    kubectl apply -f ../kubernetes/secrets.yaml --namespace="${NAMESPACE}"

    # Initialize deployment with zero-downtime strategy
    kubectl apply -f ../kubernetes/backend-deployment.yaml --namespace="${NAMESPACE}"

    # Wait for deployment to complete
    if ! kubectl rollout status deployment/garden-planner-backend \
        --namespace="${NAMESPACE}" \
        --timeout="${DEPLOYMENT_TIMEOUT}"; then
        log_error "Backend deployment failed"
        rollback "backend"
        return 1
    fi

    # Verify health checks
    local attempts=0
    local max_attempts=6

    while [[ $attempts -lt $max_attempts ]]; do
        if kubectl exec -it \
            "$(kubectl get pod -l app=garden-planner,component=backend -n "${NAMESPACE}" -o jsonpath='{.items[0].metadata.name}')" \
            -n "${NAMESPACE}" \
            -- wget --spider http://localhost:3000/health &> /dev/null; then
            log_info "Backend health check passed"
            return 0
        fi
        ((attempts++))
        sleep "${HEALTH_CHECK_INTERVAL}"
    done

    log_error "Backend health check failed after ${max_attempts} attempts"
    rollback "backend"
    return 1
}

# Deploy frontend service
deploy_frontend() {
    log_info "Deploying frontend service..."

    # Apply Nginx configurations and security headers
    kubectl apply -f ../kubernetes/web-deployment.yaml --namespace="${NAMESPACE}"

    # Wait for deployment to complete
    if ! kubectl rollout status deployment/garden-planner-web \
        --namespace="${NAMESPACE}" \
        --timeout="${DEPLOYMENT_TIMEOUT}"; then
        log_error "Frontend deployment failed"
        rollback "frontend"
        return 1
    }

    # Verify frontend health
    local attempts=0
    local max_attempts=6

    while [[ $attempts -lt $max_attempts ]]; do
        if kubectl exec -it \
            "$(kubectl get pod -l app=garden-planner,component=web -n "${NAMESPACE}" -o jsonpath='{.items[0].metadata.name}')" \
            -n "${NAMESPACE}" \
            -- wget --spider http://localhost/health &> /dev/null; then
            log_info "Frontend health check passed"
            return 0
        fi
        ((attempts++))
        sleep "${HEALTH_CHECK_INTERVAL}"
    done

    log_error "Frontend health check failed after ${max_attempts} attempts"
    rollback "frontend"
    return 1
}

# Verify deployment
verify_deployment() {
    log_info "Verifying deployment..."

    # Check backend service
    if ! kubectl get service garden-planner-backend -n "${NAMESPACE}" &> /dev/null; then
        log_error "Backend service not found"
        return 1
    fi

    # Check frontend service
    if ! kubectl get service garden-planner-web -n "${NAMESPACE}" &> /dev/null; then
        log_error "Frontend service not found"
        return 1
    }

    # Verify resource quotas
    local cpu_usage
    cpu_usage=$(kubectl top pods -n "${NAMESPACE}" | awk 'NR>1 {sum+=$2} END {print sum}')
    if [[ $cpu_usage -gt 1000 ]]; then
        log_warn "High CPU usage detected: ${cpu_usage}m"
    fi

    # Check for any pending pods
    if kubectl get pods -n "${NAMESPACE}" | grep -q "Pending"; then
        log_error "Found pending pods in deployment"
        return 1
    fi

    log_info "Deployment verification completed successfully"
    return 0
}

# Rollback deployment
rollback() {
    local component=$1
    log_warn "Initiating rollback for ${component}..."

    # Stop ongoing deployment
    kubectl rollout stop deployment/garden-planner-"${component}" \
        --namespace="${NAMESPACE}"

    # Rollback to previous version
    if ! kubectl rollout undo deployment/garden-planner-"${component}" \
        --namespace="${NAMESPACE}" \
        --timeout="${ROLLBACK_TIMEOUT}"; then
        log_error "Rollback failed for ${component}"
        return 1
    fi

    log_info "Rollback completed for ${component}"
    return 0
}

# Main deployment function
main() {
    log_info "Starting Garden Planner deployment..."

    # Create namespace if it doesn't exist
    kubectl create namespace "${NAMESPACE}" --dry-run=client -o yaml | kubectl apply -f -

    # Check prerequisites
    if ! check_prerequisites; then
        log_error "Prerequisites check failed"
        exit 1
    fi

    # Deploy backend
    if ! deploy_backend; then
        log_error "Backend deployment failed"
        exit 1
    fi

    # Deploy frontend
    if ! deploy_frontend; then
        log_error "Frontend deployment failed"
        exit 1
    fi

    # Verify deployment
    if ! verify_deployment; then
        log_error "Deployment verification failed"
        exit 1
    fi

    log_info "Garden Planner deployment completed successfully"
    return 0
}

# Execute main function
main "$@"