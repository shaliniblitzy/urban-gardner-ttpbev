# Environment Configuration
environment = "prod"

# AWS Configuration
aws_region  = "us-west-2"
aws_profile = "garden-planner-prod"

# Google Cloud / Firebase Configuration
google_project_id = "garden-planner-prod"
google_region     = "us-west2"

# Database Configuration
database_backup_retention_days = 30
database_instance_class       = "db.t3.medium"

# Monitoring and Alerting Configuration
monitoring_retention_days   = 90
prometheus_retention_days   = 90
prometheus_scrape_interval = "15s"

# Alert Thresholds
alert_thresholds = {
  cpu_usage_percent     = 80
  memory_usage_percent  = 80
  storage_usage_percent = 85
  response_time_ms      = 3000
}