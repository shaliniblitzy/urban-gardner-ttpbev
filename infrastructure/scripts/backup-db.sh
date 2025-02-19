#!/bin/bash

# Garden Planner Database Backup Script
# Version: 1.0.0
# Dependencies: sqlite3@3.39.0, coreutils@8.32

set -euo pipefail

# Source database configuration
DB_PATH="$(dirname "$(dirname "$(dirname "$0")")")/src/backend/data/garden.db"

# Global configuration
BACKUP_DIR="/var/backups/garden_planner"
LOG_FILE="/var/log/garden_planner/db_backup.log"
MIN_DISK_SPACE=5120  # Minimum required disk space in MB
COMPRESSION_LEVEL=9   # Maximum compression
BACKUP_TIMEOUT=3600  # Backup timeout in seconds

# Retention periods in days
declare -A RETENTION_DAYS=(
    ["garden"]="365"
    ["schedule"]="30"
    ["notification"]="7"
)

# Logging function with severity levels
log_message() {
    local level="$1"
    local message="$2"
    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    # Create log directory if it doesn't exist
    mkdir -p "$(dirname "$LOG_FILE")"
    
    echo "[${timestamp}] [${level}] ${message}" >> "$LOG_FILE"
    
    # Output errors to stderr
    if [[ "$level" == "ERROR" ]]; then
        echo "[${timestamp}] [${level}] ${message}" >&2
    fi
}

# Check prerequisites and system requirements
check_prerequisites() {
    local space_available
    
    # Check SQLite3 installation
    if ! command -v sqlite3 >/dev/null 2>&1; then
        log_message "ERROR" "sqlite3 is not installed"
        return 1
    fi
    
    # Check source database exists and is readable
    if [[ ! -r "$DB_PATH" ]]; then
        log_message "ERROR" "Database file not found or not readable: $DB_PATH"
        return 1
    fi
    
    # Check backup directory exists and is writable
    mkdir -p "$BACKUP_DIR" || {
        log_message "ERROR" "Cannot create backup directory: $BACKUP_DIR"
        return 1
    }
    
    # Check available disk space
    space_available=$(df -m "$BACKUP_DIR" | awk 'NR==2 {print $4}')
    if [[ "$space_available" -lt "$MIN_DISK_SPACE" ]]; then
        log_message "ERROR" "Insufficient disk space. Required: ${MIN_DISK_SPACE}MB, Available: ${space_available}MB"
        return 1
    }
    
    return 0
}

# Verify backup integrity
verify_backup() {
    local backup_path="$1"
    local temp_dir
    local verify_result
    
    temp_dir=$(mktemp -d)
    trap 'rm -rf "$temp_dir"' EXIT
    
    # Decompress backup for verification
    gzip -dc "$backup_path" > "$temp_dir/verify.db"
    
    # Run integrity check
    verify_result=$(sqlite3 "$temp_dir/verify.db" "PRAGMA integrity_check;" 2>&1)
    
    if [[ "$verify_result" == "ok" ]]; then
        log_message "INFO" "Backup integrity verified: $backup_path"
        return 0
    else
        log_message "ERROR" "Backup verification failed: $verify_result"
        return 1
    fi
}

# Create database backup
create_backup() {
    local backup_type="$1"
    local timestamp
    local backup_path
    local backup_result
    
    timestamp=$(date -u +"%Y%m%d_%H%M%S")
    backup_path="${BACKUP_DIR}/${backup_type}_${timestamp}.db"
    
    # Create backup directory structure
    mkdir -p "$BACKUP_DIR"
    
    log_message "INFO" "Starting backup of type: $backup_type"
    
    # Create atomic backup with timeout
    timeout "$BACKUP_TIMEOUT" sqlite3 "$DB_PATH" ".backup '$backup_path'" || {
        log_message "ERROR" "Backup creation failed with timeout"
        return 1
    }
    
    # Compress backup
    gzip -"$COMPRESSION_LEVEL" "$backup_path" || {
        log_message "ERROR" "Backup compression failed"
        rm -f "$backup_path"
        return 1
    }
    
    # Verify backup integrity
    if ! verify_backup "${backup_path}.gz"; then
        log_message "ERROR" "Backup verification failed"
        rm -f "${backup_path}.gz"
        return 1
    }
    
    # Set secure permissions
    chmod 640 "${backup_path}.gz"
    
    log_message "INFO" "Backup completed successfully: ${backup_path}.gz"
    return 0
}

# Clean up old backups
cleanup_old_backups() {
    local backup_type="$1"
    local retention_days="${RETENTION_DAYS[$backup_type]}"
    local removed_count=0
    local freed_space=0
    
    log_message "INFO" "Starting cleanup for $backup_type backups"
    
    # Find and remove old backups
    while IFS= read -r backup_file; do
        if [[ -f "$backup_file" ]]; then
            local file_size
            file_size=$(stat -f %z "$backup_file")
            rm -f "$backup_file"
            ((removed_count++))
            ((freed_space+=file_size))
            log_message "INFO" "Removed old backup: $backup_file"
        fi
    done < <(find "$BACKUP_DIR" -name "${backup_type}_*.db.gz" -mtime +"$retention_days")
    
    log_message "INFO" "Cleanup completed. Removed $removed_count files, freed $((freed_space/1024/1024))MB"
    return 0
}

# Main backup process
main() {
    local backup_type="$1"
    local start_time
    start_time=$(date +%s)
    
    # Validate backup type
    if [[ ! "${RETENTION_DAYS[$backup_type]+isset}" ]]; then
        log_message "ERROR" "Invalid backup type: $backup_type"
        exit 1
    }
    
    # Check prerequisites
    if ! check_prerequisites; then
        log_message "ERROR" "Prerequisites check failed"
        exit 1
    }
    
    # Create backup
    if ! create_backup "$backup_type"; then
        log_message "ERROR" "Backup creation failed"
        exit 1
    }
    
    # Clean up old backups
    if ! cleanup_old_backups "$backup_type"; then
        log_message "WARNING" "Backup cleanup failed"
    fi
    
    # Log completion time
    local end_time
    end_time=$(date +%s)
    log_message "INFO" "Backup process completed in $((end_time-start_time)) seconds"
}

# Script execution
if [[ "${#}" -ne 1 ]]; then
    echo "Usage: $0 <backup_type>"
    echo "Backup types: garden, schedule, notification"
    exit 1
fi

main "$1"