# Environment Configuration
environment                = "staging"
aws_region                = "us-west-2"
aws_profile               = "garden-planner-staging"
google_project_id         = "garden-planner-staging"
google_region             = "us-west2"

# Application Configuration
app_instance_type         = "t3.medium"
app_min_instances         = 2
app_max_instances         = 4
app_cpu_threshold         = 70
app_memory_threshold      = 75

# Database Configuration
database_instance_class           = "db.t3.small"
database_storage_gb              = 50
database_max_connections         = 100
database_backup_retention_days   = 14
database_backup_window           = "03:00-04:00"
database_maintenance_window      = "Sun:04:00-Sun:05:00"
backup_start_window             = 1
backup_completion_window        = 2
performance_insights_retention_period = 7

# Monitoring and Logging Configuration
monitoring_retention_days = 45
log_retention_days       = 30
alert_email             = "alerts-staging@gardenplanner.com"
error_tracking_dsn      = "https://sentry.io/staging/garden-planner"
analytics_measurement_id = "G-STAG123456"

# Service Integration
fcm_service_account_key = "garden-planner-staging-fcm.json"

# Network Configuration
vpc_cidr         = "10.1.0.0/16"
private_subnets  = ["10.1.1.0/24", "10.1.2.0/24"]
public_subnets   = ["10.1.101.0/24", "10.1.102.0/24"]
allowed_ip_ranges = ["10.0.0.0/8"]

# API Configuration
api_rate_limit   = 1000
api_burst_limit  = 2000

# CDN Configuration
cdn_ttl_seconds  = 3600
ssl_certificate_arn = "arn:aws:acm:us-west-2:123456789012:certificate/staging-cert"

# CloudWatch Metric Alarms
cloudwatch_metric_alarms = {
  cpu_utilization_threshold      = 80
  memory_utilization_threshold   = 85
  disk_queue_depth_threshold     = 10
  freeable_memory_threshold      = 256  # MB
  free_storage_space_threshold   = 5120 # MB
}