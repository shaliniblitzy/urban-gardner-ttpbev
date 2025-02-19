# Output definitions for the Garden Planner database module
# Exposes essential database connection and configuration details

output "database_endpoint" {
  description = "Database instance endpoint URL"
  value       = aws_db_instance.database.endpoint
  sensitive   = true
}

output "database_address" {
  description = "Database instance host address"
  value       = aws_db_instance.database.address
  sensitive   = true
}

output "database_port" {
  description = "Database instance port number"
  value       = aws_db_instance.database.port
}

output "security_group_id" {
  description = "ID of the security group attached to the database"
  value       = aws_security_group.database.id
}

output "database_name" {
  description = "Name of the database instance"
  value       = aws_db_instance.database.identifier
}

output "monitoring_role_arn" {
  description = "ARN of the IAM role used for enhanced monitoring"
  value       = aws_db_instance.database.monitoring_role_arn
}

output "backup_retention_period" {
  description = "Number of days automated backups are retained"
  value       = aws_db_instance.database.backup_retention_period
}

output "performance_insights_enabled" {
  description = "Whether Performance Insights is enabled for the database"
  value       = aws_db_instance.database.performance_insights_enabled
}

output "cloudwatch_log_exports" {
  description = "List of log types exported to CloudWatch"
  value       = aws_db_instance.database.enabled_cloudwatch_logs_exports
}

output "subnet_group_name" {
  description = "Name of the database subnet group"
  value       = aws_db_subnet_group.database.name
}