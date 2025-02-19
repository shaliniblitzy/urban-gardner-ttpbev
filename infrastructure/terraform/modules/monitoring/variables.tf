# Environment variable with validation for allowed values
variable "environment" {
  type        = string
  description = "Environment name for monitoring resources (dev, staging, prod)"
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

# AWS region for infrastructure deployment
variable "region" {
  type        = string
  description = "AWS region for monitoring infrastructure deployment"
}

# Prometheus data retention configuration with validation
variable "prometheus_retention_days" {
  type        = number
  description = "Number of days to retain Prometheus metrics data"
  default     = 30

  validation {
    condition     = var.prometheus_retention_days >= 1 && var.prometheus_retention_days <= 90
    error_message = "Prometheus retention days must be between 1 and 90"
  }
}

# Prometheus scrape interval with format validation
variable "prometheus_scrape_interval" {
  type        = string
  description = "Interval for Prometheus metrics collection"
  default     = "30s"

  validation {
    condition     = can(regex("^[0-9]+(s|m)$", var.prometheus_scrape_interval))
    error_message = "Scrape interval must be specified in seconds (s) or minutes (m)"
  }
}

# Grafana admin password with security validation
variable "grafana_admin_password" {
  type        = string
  description = "Admin password for Grafana dashboard access"
  sensitive   = true

  validation {
    condition     = length(var.grafana_admin_password) >= 8
    error_message = "Grafana admin password must be at least 8 characters long"
  }
}

# Alert notification email with format validation
variable "alert_email" {
  type        = string
  description = "Email address for monitoring alerts"

  validation {
    condition     = can(regex("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$", var.alert_email))
    error_message = "Must provide a valid email address"
  }
}

# Alert thresholds with validation for positive values
variable "alert_thresholds" {
  type        = map(number)
  description = "Threshold values for different monitoring metrics"
  default = {
    cpu_usage_percent     = 80
    memory_usage_percent  = 80
    storage_usage_percent = 85
    response_time_ms      = 3000
  }

  validation {
    condition     = alltrue([for k, v in var.alert_thresholds : v > 0])
    error_message = "All threshold values must be greater than 0"
  }
}