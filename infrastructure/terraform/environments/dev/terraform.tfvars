# Environment Configuration
environment = "dev"

# AWS Configuration
aws_region  = "us-west-2"
aws_profile = "garden_planner_dev"

# Google Cloud / Firebase Configuration
google_project_id = "garden-planner-dev"
google_region     = "us-central1"

# Database Configuration
database_backup_retention_days = 7
database_instance_class       = "db.t3.micro"

# Database Module Configuration
database = {
  vpc_id               = "vpc-dev01"
  backup_retention_days = 7
  instance_class       = "db.t3.micro"
  max_connections      = 100
  storage_type         = "gp2"
  storage_size_gb      = 20
}

# Notification Service Configuration
notification_delivery_threshold = 0.95
notifications = {
  notification_delivery_threshold = 0.95
  notification_channel_id        = "dev-channel-01"
  fcm_api_version               = "v1"
  max_retry_attempts            = 3
}

# Monitoring Configuration
monitoring_retention_days = 30
monitoring = {
  alert_threshold_cpu     = 80
  alert_threshold_memory  = 85
  alert_threshold_storage = 90
  metrics_resolution      = "60s"
}

# Error Tracking Configuration
error_tracking_retention_days = 14

# Analytics Configuration
analytics_event_retention_days = 30

# Alert Configuration
alert_email = "dev-alerts@gardenplanner.com"