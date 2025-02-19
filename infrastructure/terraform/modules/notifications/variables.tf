# Terraform variables definition file for Firebase Cloud Messaging (FCM) infrastructure module
# Version: 1.0
# Provider version: hashicorp/terraform ~> 1.0

variable "project_id" {
  type        = string
  description = "The Google Cloud project ID where FCM infrastructure will be created"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{4,28}[a-z0-9]$", var.project_id))
    error_message = "Project ID must be between 6 and 30 characters, start with a letter, and contain only lowercase letters, numbers, and hyphens."
  }
}

variable "service_account_key" {
  type        = string
  description = "The service account key JSON for authenticating with Google Cloud and FCM services. Must have Firebase Admin SDK permissions."
  sensitive   = true

  validation {
    condition     = can(jsondecode(var.service_account_key))
    error_message = "Service account key must be a valid JSON string."
  }
}

variable "notification_delivery_threshold" {
  type        = number
  description = "The minimum acceptable notification delivery rate as a decimal between 0 and 1. Used for monitoring alerts and scaling decisions."
  default     = 0.95

  validation {
    condition     = var.notification_delivery_threshold >= 0 && var.notification_delivery_threshold <= 1
    error_message = "Notification delivery threshold must be between 0 and 1."
  }
}

variable "notification_channel_id" {
  type        = string
  description = "The Google Cloud monitoring notification channel ID for sending alerts when delivery rates fall below threshold."

  validation {
    condition     = can(regex("^[a-zA-Z0-9-_]+$", var.notification_channel_id))
    error_message = "Notification channel ID must contain only alphanumeric characters, hyphens, and underscores."
  }
}