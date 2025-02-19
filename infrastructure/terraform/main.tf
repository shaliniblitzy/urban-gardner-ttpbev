# Garden Planner Infrastructure Configuration
# Version: 1.0.0
# Provider versions: AWS ~> 4.0, Google ~> 4.0, Google Beta ~> 4.0

terraform {
  required_version = ">= 1.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 4.0"
    }
  }

  backend "s3" {
    bucket         = "garden-planner-terraform-state"
    key            = "terraform.tfstate"
    region         = var.aws_region
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
  }
}

# Local variables for resource naming and tagging
locals {
  common_tags = {
    Project        = "GardenPlanner"
    Environment    = var.environment
    ManagedBy      = "Terraform"
    SecurityLevel  = "High"
    BackupEnabled  = "True"
  }
}

# AWS Provider Configuration
provider "aws" {
  region = var.aws_region
  default_tags {
    tags = local.common_tags
  }
}

# Google Cloud Provider Configuration for Firebase
provider "google" {
  project     = var.google_project_id
  region      = var.google_region
  credentials = var.fcm_service_account_key
}

provider "google-beta" {
  project     = var.google_project_id
  region      = var.google_region
  credentials = var.fcm_service_account_key
}

# Database Infrastructure Module
module "database" {
  source = "./modules/database"

  environment              = var.environment
  backup_retention_days    = var.database_backup_retention_days
  instance_class          = var.database_instance_class
  multi_az               = true
  encryption_enabled     = true
  backup_window         = "03:00-04:00"
  maintenance_window    = "Mon:04:00-Mon:05:00"
  deletion_protection   = true
  monitoring_interval   = 60

  tags = merge(local.common_tags, {
    Component = "Database"
  })
}

# Notification Infrastructure Module
module "notifications" {
  source = "./modules/notifications"

  project_id              = var.google_project_id
  service_account_key     = var.fcm_service_account_key
  notification_delivery_threshold = 0.95
  notification_channel_id = "garden-planner-alerts"

  depends_on = [module.database]
}

# Monitoring Infrastructure Module
module "monitoring" {
  source = "./modules/monitoring"

  environment               = var.environment
  region                   = var.aws_region
  prometheus_retention_days = var.monitoring_retention_days
  prometheus_scrape_interval = "30s"
  grafana_admin_password   = var.grafana_admin_password
  alert_email             = var.alert_email
  alert_thresholds = {
    cpu_usage_percent     = 80
    memory_usage_percent  = 85
    disk_usage           = 90
    error_rate           = 1
  }

  depends_on = [module.database, module.notifications]
}

# Output Definitions
output "database_connection_string" {
  description = "Encrypted database connection string for application use"
  value       = module.database.database_endpoint
  sensitive   = true
}

output "fcm_credentials" {
  description = "Firebase Cloud Messaging credentials"
  value = {
    server_key     = module.notifications.fcm_server_key
    project_number = module.notifications.fcm_project_number
  }
  sensitive = true
}

output "monitoring_endpoints" {
  description = "Monitoring service endpoints"
  value = {
    prometheus    = module.monitoring.prometheus_endpoint
    grafana      = module.monitoring.grafana_endpoint
    alert_webhook = module.monitoring.alert_webhook_url
  }
}