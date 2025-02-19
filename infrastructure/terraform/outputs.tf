# Database connection outputs
output "database_connection" {
  description = "Database connection details for application configuration"
  value = {
    endpoint = module.database.database_endpoint
    name     = module.database.database_name
  }
  sensitive = true
}

# Firebase Cloud Messaging (FCM) credentials
output "fcm_credentials" {
  description = "Firebase Cloud Messaging credentials for notification service"
  value = {
    server_key     = module.notifications.fcm_server_key
    project_number = module.notifications.project_number
  }
  sensitive = true
}

# Monitoring service endpoints
output "monitoring_endpoints" {
  description = "Monitoring service endpoints for observability"
  value = {
    prometheus    = module.monitoring.prometheus_endpoint
    grafana      = module.monitoring.grafana_endpoint
    alertmanager = module.monitoring.alertmanager_endpoint
  }
}

# System health status outputs
output "system_health" {
  description = "System health and availability status"
  value = {
    database_status     = module.database.database_endpoint != null ? "available" : "unavailable"
    monitoring_status   = module.monitoring.prometheus_endpoint != null ? "available" : "unavailable"
    notification_status = module.notifications.fcm_server_key != null ? "available" : "unavailable"
  }
}

# Resource identifiers
output "resource_ids" {
  description = "Infrastructure resource identifiers"
  value = {
    database_identifier = module.database.database_endpoint != null ? split(":", module.database.database_endpoint)[0] : null
    monitoring_namespace = module.monitoring.prometheus_endpoint != null ? split(".")[1] : null
    fcm_project = module.notifications.project_number != null ? "project-${module.notifications.project_number}" : null
  }
}

# Environment information
output "environment_info" {
  description = "Environment configuration details"
  value = {
    environment = var.environment
    region      = var.region
    timestamp   = timestamp()
  }
}