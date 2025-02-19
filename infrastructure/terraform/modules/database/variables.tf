variable "vpc_id" {
  type        = string
  description = "ID of the VPC where the database will be deployed"

  validation {
    condition     = can(regex("^vpc-", var.vpc_id))
    error_message = "VPC ID must begin with 'vpc-'"
  }
}

variable "environment" {
  type        = string
  description = "Deployment environment (dev/staging/prod)"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

variable "backup_retention_days" {
  type        = number
  description = "Number of days to retain database backups"
  default     = 7

  validation {
    condition     = var.backup_retention_days >= 1 && var.backup_retention_days <= 35
    error_message = "Backup retention period must be between 1 and 35 days"
  }
}

variable "instance_class" {
  type        = string
  description = "Database instance class"
  default     = "db.t3.micro"

  validation {
    condition     = can(regex("^db\\.", var.instance_class))
    error_message = "Instance class must begin with 'db.'"
  }
}