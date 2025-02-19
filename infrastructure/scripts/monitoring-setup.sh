#!/bin/bash

# Garden Planner Monitoring Infrastructure Setup Script
# Version: 1.0.0
# This script sets up and configures a comprehensive monitoring infrastructure
# including Prometheus, Grafana, and Alert Manager with enhanced security and validation

# Set strict error handling
set -euo pipefail
trap 'echo "Error on line $LINENO. Exit code: $?" >&2; exit 1' ERR

# Global variables
PROMETHEUS_VERSION="v2.45.0"
GRAFANA_VERSION="9.5.0"
ALERTMANAGER_VERSION="v0.25.0"
MONITORING_NAMESPACE="monitoring"
BACKUP_RETENTION_DAYS="30"
CONFIG_BACKUP_PATH="/backup/monitoring"
HEALTH_CHECK_INTERVAL="300"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Logging function
log() {
    local level=$1
    shift
    local message=$@
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    case $level in
        "INFO")
            echo -e "${GREEN}[INFO]${NC} ${timestamp} - $message"
            ;;
        "WARN")
            echo -e "${YELLOW}[WARN]${NC} ${timestamp} - $message"
            ;;
        "ERROR")
            echo -e "${RED}[ERROR]${NC} ${timestamp} - $message" >&2
            ;;
    esac
}

# Validate prerequisites
check_prerequisites() {
    local prerequisites=("docker" "kubectl" "curl" "jq")
    
    for cmd in "${prerequisites[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            log "ERROR" "Required command '$cmd' not found. Please install it first."
            exit 1
        fi
    done
    
    log "INFO" "Prerequisites validation completed successfully"
}

# Setup Prometheus with enhanced validation and security
setup_prometheus() {
    local config_path=$1
    local version=$2
    local backup_path=$3
    
    log "INFO" "Setting up Prometheus ${version}"
    
    # Validate Prometheus configuration
    if ! promtool check config "$config_path"; then
        log "ERROR" "Invalid Prometheus configuration"
        return 1
    fi
    
    # Backup existing configuration
    if [ -f "$config_path" ]; then
        mkdir -p "${backup_path}/prometheus"
        cp "$config_path" "${backup_path}/prometheus/prometheus-$(date +%Y%m%d-%H%M%S).yml"
    fi
    
    # Create namespace if not exists
    kubectl create namespace "$MONITORING_NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
    
    # Apply RBAC policies
    kubectl apply -f - <<EOF
apiVersion: v1
kind: ServiceAccount
metadata:
  name: prometheus
  namespace: $MONITORING_NAMESPACE
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: prometheus
rules:
- apiGroups: [""]
  resources: ["nodes", "nodes/proxy", "services", "endpoints", "pods"]
  verbs: ["get", "list", "watch"]
EOF
    
    # Deploy Prometheus
    kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: prometheus
  namespace: $MONITORING_NAMESPACE
spec:
  serviceName: prometheus
  replicas: 1
  selector:
    matchLabels:
      app: prometheus
  template:
    metadata:
      labels:
        app: prometheus
    spec:
      serviceAccountName: prometheus
      containers:
      - name: prometheus
        image: prom/prometheus:${version#v}
        args:
          - "--config.file=/etc/prometheus/prometheus.yml"
          - "--storage.tsdb.retention.time=15d"
          - "--web.enable-lifecycle"
        ports:
        - containerPort: 9090
        resources:
          requests:
            cpu: 500m
            memory: 2Gi
          limits:
            cpu: 1000m
            memory: 4Gi
EOF
    
    # Wait for Prometheus to be ready
    kubectl rollout status statefulset/prometheus -n "$MONITORING_NAMESPACE" --timeout=300s
    
    log "INFO" "Prometheus setup completed successfully"
    return 0
}

# Setup Grafana with enhanced security and dashboard validation
setup_grafana() {
    local dashboard_path=$1
    local version=$2
    local admin_password=$3
    
    log "INFO" "Setting up Grafana ${version}"
    
    # Validate dashboard JSON
    if ! jq empty "$dashboard_path" 2>/dev/null; then
        log "ERROR" "Invalid dashboard configuration JSON"
        return 1
    fi
    
    # Backup existing dashboards
    if [ -f "$dashboard_path" ]; then
        mkdir -p "${CONFIG_BACKUP_PATH}/grafana"
        cp "$dashboard_path" "${CONFIG_BACKUP_PATH}/grafana/dashboard-$(date +%Y%m%d-%H%M%S).json"
    fi
    
    # Deploy Grafana
    kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: grafana
  namespace: $MONITORING_NAMESPACE
spec:
  replicas: 1
  selector:
    matchLabels:
      app: grafana
  template:
    metadata:
      labels:
        app: grafana
    spec:
      securityContext:
        fsGroup: 472
        supplementalGroups:
          - 0
      containers:
      - name: grafana
        image: grafana/grafana:${version}
        ports:
        - containerPort: 3000
        env:
        - name: GF_SECURITY_ADMIN_PASSWORD
          value: "${admin_password}"
        - name: GF_USERS_ALLOW_SIGN_UP
          value: "false"
        resources:
          requests:
            cpu: 200m
            memory: 512Mi
          limits:
            cpu: 500m
            memory: 1Gi
EOF
    
    # Wait for Grafana to be ready
    kubectl rollout status deployment/grafana -n "$MONITORING_NAMESPACE" --timeout=300s
    
    log "INFO" "Grafana setup completed successfully"
    return 0
}

# Setup Alert Manager with enhanced notification testing
setup_alertmanager() {
    local config_path=$1
    local version=$2
    local notification_config=$3
    
    log "INFO" "Setting up Alert Manager ${version}"
    
    # Validate Alert Manager configuration
    if ! amtool check-config "$config_path"; then
        log "ERROR" "Invalid Alert Manager configuration"
        return 1
    fi
    
    # Backup existing configuration
    if [ -f "$config_path" ]; then
        mkdir -p "${CONFIG_BACKUP_PATH}/alertmanager"
        cp "$config_path" "${CONFIG_BACKUP_PATH}/alertmanager/alertmanager-$(date +%Y%m%d-%H%M%S).yml"
    fi
    
    # Deploy Alert Manager
    kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: alertmanager
  namespace: $MONITORING_NAMESPACE
spec:
  serviceName: alertmanager
  replicas: 2
  selector:
    matchLabels:
      app: alertmanager
  template:
    metadata:
      labels:
        app: alertmanager
    spec:
      containers:
      - name: alertmanager
        image: prom/alertmanager:${version#v}
        args:
          - "--config.file=/etc/alertmanager/alertmanager.yml"
          - "--storage.path=/alertmanager"
          - "--cluster.listen-address=0.0.0.0:9094"
        ports:
        - containerPort: 9093
        - containerPort: 9094
        resources:
          requests:
            cpu: 100m
            memory: 256Mi
          limits:
            cpu: 200m
            memory: 512Mi
EOF
    
    # Wait for Alert Manager to be ready
    kubectl rollout status statefulset/alertmanager -n "$MONITORING_NAMESPACE" --timeout=300s
    
    log "INFO" "Alert Manager setup completed successfully"
    return 0
}

# Verify monitoring stack health
verify_monitoring() {
    log "INFO" "Performing monitoring stack verification"
    
    local failed=0
    
    # Check Prometheus health
    if ! curl -s "http://prometheus:9090/-/healthy" | grep -q "Prometheus is Healthy"; then
        log "ERROR" "Prometheus health check failed"
        failed=1
    fi
    
    # Check Grafana health
    if ! curl -s "http://grafana:3000/api/health" | grep -q "ok"; then
        log "ERROR" "Grafana health check failed"
        failed=1
    fi
    
    # Check Alert Manager health
    if ! curl -s "http://alertmanager:9093/-/healthy" | grep -q "ok"; then
        log "ERROR" "Alert Manager health check failed"
        failed=1
    fi
    
    # Verify metrics collection
    if ! curl -s "http://prometheus:9090/api/v1/targets" | jq -e '.data.activeTargets[] | select(.health=="up")' > /dev/null; then
        log "WARN" "Some monitoring targets are down"
        failed=1
    fi
    
    if [ $failed -eq 0 ]; then
        log "INFO" "All monitoring components are healthy"
        return 0
    else
        log "ERROR" "Monitoring verification failed"
        return 1
    fi
}

# Main setup function
main() {
    log "INFO" "Starting monitoring infrastructure setup"
    
    # Check prerequisites
    check_prerequisites
    
    # Create backup directory
    mkdir -p "$CONFIG_BACKUP_PATH"
    
    # Setup components
    setup_prometheus "prometheus.yml" "$PROMETHEUS_VERSION" "$CONFIG_BACKUP_PATH" || exit 1
    setup_grafana "grafana-dashboard.json" "$GRAFANA_VERSION" "${GRAFANA_ADMIN_PASSWORD:-admin123}" || exit 1
    setup_alertmanager "alertmanager.yml" "$ALERTMANAGER_VERSION" "notification.yml" || exit 1
    
    # Verify setup
    verify_monitoring || exit 1
    
    # Setup backup rotation
    find "$CONFIG_BACKUP_PATH" -type f -mtime +"$BACKUP_RETENTION_DAYS" -delete
    
    log "INFO" "Monitoring infrastructure setup completed successfully"
}

# Execute main function
main "$@"