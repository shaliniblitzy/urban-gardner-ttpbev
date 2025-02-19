# Environment variable for deployment stage
variable "environment" {
  type        = string
  description = "Deployment environment (dev, staging, prod)"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

# AWS Configuration Variables
variable "aws_region" {
  type        = string
  description = "AWS region for infrastructure deployment"
}

variable "aws_profile" {
  type        = string
  description = "AWS credentials profile name"
}

# Google Cloud / Firebase Configuration Variables
variable "google_project_id" {
  type        = string
  description = "Google Cloud project ID for Firebase services"
  validation {
    condition     = length(var.google_project_id) > 0
    error_message = "Project ID must not be empty"
  }
}

variable "google_region" {
  type        = string
  description = "Google Cloud region for Firebase services"
}

variable "fcm_service_account_key" {
  type        = string
  description = "Firebase Cloud Messaging service account key"
  sensitive   = true
}

# Database Configuration Variables
variable "database_backup_retention_days" {
  type        = number
  description = "Number of days to retain database backups"
  default     = 7
  validation {
    condition     = var.database_backup_retention_days >= 1 && var.database_backup_retention_days <= 35
    error_message = "Backup retention days must be between 1 and 35"
  }
}

variable "database_instance_class" {
  type        = string
  description = "Database instance type specification"
  default     = "db.t3.micro"
  validation {
    condition     = can(regex("^db\\.", var.database_instance_class))
    error_message = "Instance class must start with 'db.'"
  }
}

# Monitoring and Alerting Configuration Variables
variable "monitoring_retention_days" {
  type        = number
  description = "Number of days to retain monitoring data"
  default     = 30
  validation {
    condition     = var.monitoring_retention_days >= 1 && var.monitoring_retention_days <= 90
    error_message = "Monitoring retention days must be between 1 and 90"
  }
}

variable "alert_email" {
  type        = string
  description = "Email address for monitoring alerts"
  validation {
    condition     = can(regex("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$", var.alert_email))
    error_message = "Must provide a valid email address"
  }
}