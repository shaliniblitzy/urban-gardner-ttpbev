#!/bin/bash

# Garden Planner Application Rollback Script
# Version: 1.0.0
# Handles automated rollback procedures for both backend and frontend components
# with proper state verification and health monitoring

set -euo pipefail

# Global Configuration
NAMESPACE=${NAMESPACE:-garden-planner}
ROLLBACK_TIMEOUT=${ROLLBACK_TIMEOUT:-180s}
MAX_RETRY_ATTEMPTS=${MAX_RETRY_ATTEMPTS:-3}
HEALTH_CHECK_INTERVAL=${HEALTH_CHECK_INTERVAL:-10s}
LOG_LEVEL=${LOG_LEVEL:-INFO}
BACKUP_RETENTION=${BACKUP_RETENTION:-24h}
NOTIFICATION_ENDPOINTS=${NOTIFICATION_ENDPOINTS:-slack,email}
METRICS_ENABLED=${METRICS_ENABLED:-true}

# Color codes for output formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    if [[ "${LOG_LEVEL}" == "INFO" || "${LOG_LEVEL}" == "DEBUG" ]]; then
        echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] ${GREEN}INFO:${NC} $1"
    fi
}

log_warn() {
    echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] ${YELLOW}WARN:${NC} $1"
}

log_error() {
    echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] ${RED}ERROR:${NC} $1"
}

# Validate prerequisites before rollback
validate_prerequisites() {
    local component="$1"
    
    log_info "Validating prerequisites for ${component} rollback"
    
    # Check kubectl availability
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed"
        return 1
    }
    
    # Verify cluster connectivity
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Unable to connect to Kubernetes cluster"
        return 1
    }
    
    # Check namespace existence
    if ! kubectl get namespace "${NAMESPACE}" &> /dev/null; then
        log_error "Namespace ${NAMESPACE} does not exist"
        return 1
    }
    
    # Verify deployment existence
    if ! kubectl get deployment "${component}" -n "${NAMESPACE}" &> /dev/null; then
        log_error "Deployment ${component} not found in namespace ${NAMESPACE}"
        return 1
    }
    
    return 0
}

# Check deployment status with enhanced health verification
check_deployment_status() {
    local component="$1"
    local attempts=0
    local max_attempts=30
    
    log_info "Checking deployment status for ${component}"
    
    while [ $attempts -lt $max_attempts ]; do
        # Get deployment status
        local ready_replicas=$(kubectl get deployment "${component}" -n "${NAMESPACE}" -o jsonpath='{.status.readyReplicas}')
        local desired_replicas=$(kubectl get deployment "${component}" -n "${NAMESPACE}" -o jsonpath='{.spec.replicas}')
        
        if [ "${ready_replicas}" == "${desired_replicas}" ]; then
            # Verify health endpoints
            if verify_health_endpoints "${component}"; then
                log_info "${component} deployment is healthy"
                return 0
            fi
        fi
        
        log_warn "Waiting for ${component} deployment to stabilize (${attempts}/${max_attempts})"
        sleep "${HEALTH_CHECK_INTERVAL}"
        ((attempts++))
    done
    
    log_error "${component} deployment failed to stabilize"
    return 1
}

# Verify health endpoints
verify_health_endpoints() {
    local component="$1"
    local health_endpoint
    
    case "${component}" in
        "garden-planner-backend")
            health_endpoint="/health"
            port="3000"
            ;;
        "garden-planner-web")
            health_endpoint="/health"
            port="80"
            ;;
        *)
            log_error "Unknown component: ${component}"
            return 1
            ;;
    esac
    
    # Get pod IP
    local pod_ip=$(kubectl get pods -n "${NAMESPACE}" -l "app=${component}" -o jsonpath='{.items[0].status.podIP}')
    
    # Check health endpoint
    if ! curl -s "http://${pod_ip}:${port}${health_endpoint}" | grep -q "OK"; then
        log_error "Health check failed for ${component}"
        return 1
    fi
    
    return 0
}

# Execute rollback for specified deployment
rollback_deployment() {
    local component="$1"
    local revision="$2"
    
    log_info "Initiating rollback for ${component} to revision ${revision}"
    
    # Create backup of current state
    if ! create_backup "${component}"; then
        log_error "Failed to create backup for ${component}"
        return 1
    fi
    
    # Execute rollback
    if ! kubectl rollout undo deployment/"${component}" -n "${NAMESPACE}" --to-revision="${revision}"; then
        log_error "Failed to rollback ${component}"
        restore_backup "${component}"
        return 1
    fi
    
    # Wait for rollback to complete
    if ! kubectl rollout status deployment/"${component}" -n "${NAMESPACE}" --timeout="${ROLLBACK_TIMEOUT}"; then
        log_error "Rollback timeout for ${component}"
        restore_backup "${component}"
        return 1
    fi
    
    # Verify deployment health
    if ! check_deployment_status "${component}"; then
        log_error "Health check failed after rollback for ${component}"
        restore_backup "${component}"
        return 1
    }
    
    log_info "Successfully rolled back ${component}"
    return 0
}

# Create backup of current state
create_backup() {
    local component="$1"
    local backup_dir="/tmp/garden-planner-backups/${component}/$(date +%Y%m%d_%H%M%S)"
    
    log_info "Creating backup for ${component}"
    
    mkdir -p "${backup_dir}"
    
    # Export deployment configuration
    if ! kubectl get deployment "${component}" -n "${NAMESPACE}" -o yaml > "${backup_dir}/deployment.yaml"; then
        log_error "Failed to backup deployment configuration"
        return 1
    }
    
    # Export configmaps
    if ! kubectl get configmap -n "${NAMESPACE}" -l "app=${component}" -o yaml > "${backup_dir}/configmaps.yaml"; then
        log_warn "No configmaps found for ${component}"
    fi
    
    # Export secrets
    if ! kubectl get secret -n "${NAMESPACE}" -l "app=${component}" -o yaml > "${backup_dir}/secrets.yaml"; then
        log_warn "No secrets found for ${component}"
    fi
    
    return 0
}

# Restore backup if rollback fails
restore_backup() {
    local component="$1"
    local latest_backup=$(ls -td /tmp/garden-planner-backups/${component}/* | head -1)
    
    log_warn "Restoring backup for ${component}"
    
    if [ -d "${latest_backup}" ]; then
        kubectl apply -f "${latest_backup}/deployment.yaml"
        
        if [ -f "${latest_backup}/configmaps.yaml" ]; then
            kubectl apply -f "${latest_backup}/configmaps.yaml"
        fi
        
        if [ -f "${latest_backup}/secrets.yaml" ]; then
            kubectl apply -f "${latest_backup}/secrets.yaml"
        fi
    else
        log_error "No backup found for ${component}"
        return 1
    fi
    
    return 0
}

# Cleanup old resources
cleanup_resources() {
    local component="$1"
    
    log_info "Cleaning up resources for ${component}"
    
    # Remove old backups
    find /tmp/garden-planner-backups/${component} -mtime +1 -type d -exec rm -rf {} +
    
    # Clean up any failed pods
    kubectl delete pods -n "${NAMESPACE}" -l "app=${component}" --field-selector status.phase=Failed
    
    return 0
}

# Main execution
main() {
    local component="$1"
    local revision="$2"
    
    log_info "Starting rollback process for ${component}"
    
    # Validate prerequisites
    if ! validate_prerequisites "${component}"; then
        log_error "Prerequisites validation failed"
        exit 1
    fi
    
    # Execute rollback
    if ! rollback_deployment "${component}" "${revision}"; then
        log_error "Rollback failed for ${component}"
        exit 1
    fi
    
    # Cleanup resources
    if ! cleanup_resources "${component}"; then
        log_warn "Resource cleanup failed for ${component}"
    fi
    
    log_info "Rollback completed successfully for ${component}"
    exit 0
}

# Script entry point
if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <component-name> <revision-number>"
    echo "Example: $0 garden-planner-backend 2"
    exit 1
fi

main "$1" "$2"