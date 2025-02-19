# Terraform configuration for Firebase Cloud Messaging (FCM) infrastructure
# Version: 1.0
# Provider requirements: google ~> 4.0, google-beta ~> 4.0

terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 4.0"
    }
  }
}

# Configure Google Cloud provider with project and authentication
provider "google" {
  project     = var.project_id
  credentials = var.service_account_key
}

# Configure Google Beta provider for Firebase-specific resources
provider "google-beta" {
  project     = var.project_id
  credentials = var.service_account_key
}

# Enable required Google Cloud APIs
resource "google_project_service" "fcm_apis" {
  provider = google-beta
  project  = var.project_id
  for_each = toset([
    "firebase.googleapis.com",
    "fcm.googleapis.com",
    "apikeys.googleapis.com",
    "monitoring.googleapis.com"
  ])
  service            = each.key
  disable_on_destroy = false
}

# Create Firebase project
resource "google_firebase_project" "main" {
  provider = google-beta
  project  = var.project_id
  depends_on = [
    google_project_service.fcm_apis
  ]
}

# Create FCM server key for authentication
resource "google_apikeys_key" "fcm_api_key" {
  provider     = google-beta
  name         = "fcm-server-key"
  project      = var.project_id
  display_name = "Firebase Cloud Messaging Server Key"

  restrictions {
    api_targets {
      service = "fcm.googleapis.com"
    }
  }

  depends_on = [
    google_firebase_project.main,
    google_project_service.fcm_apis
  ]
}

# Configure monitoring alert policy for notification delivery rate
resource "google_monitoring_alert_policy" "notification_delivery" {
  provider     = google-beta
  project      = var.project_id
  display_name = "FCM Delivery Rate Alert"
  
  conditions {
    display_name = "Notification Delivery Rate Below Threshold"
    
    condition_threshold {
      filter          = "metric.type=\"fcm.googleapis.com/notification_delivery_rate\""
      duration        = "300s"
      comparison      = "COMPARISON_LT"
      threshold_value = var.notification_delivery_threshold
      
      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }

  notification_channels = [var.notification_channel_id]
  
  alert_strategy {
    auto_close = "3600s"
  }

  depends_on = [
    google_project_service.fcm_apis
  ]
}

# Configure FCM topic for garden maintenance notifications
resource "google_firebase_messaging_topic" "maintenance_notifications" {
  provider = google-beta
  project  = var.project_id
  name     = "garden_maintenance"
  
  depends_on = [
    google_firebase_project.main
  ]
}

# Output the Firebase project number for client configuration
output "firebase_project_number" {
  value       = google_firebase_project.main.project_number
  description = "The Firebase project number required for client-side FCM configuration"
}

# Output the FCM server key for backend services
output "fcm_server_key" {
  value       = google_apikeys_key.fcm_api_key.key_string
  description = "The FCM server key for authenticating notification requests"
  sensitive   = true
}