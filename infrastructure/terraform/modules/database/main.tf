# Garden Planner Database Infrastructure Module
# Terraform AWS Provider v4.0
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

# Local variables for resource naming and tagging
locals {
  database_name       = "garden_planner_${var.environment}"
  database_identifier = "gp-db-${var.environment}"
  common_tags = {
    Name            = "garden-planner-db"
    Environment     = var.environment
    ManagedBy       = "Terraform"
    Application     = "GardenPlanner"
    BackupRetention = var.backup_retention_days
    LastUpdated     = timestamp()
  }
}

# Data source to fetch private subnets from VPC
data "aws_subnets" "private" {
  filter {
    name   = "vpc-id"
    values = [var.vpc_id]
  }
  tags = {
    Tier = "private"
  }
}

# Database subnet group
resource "aws_db_subnet_group" "database" {
  name        = "${local.database_identifier}-subnet-group"
  description = "Subnet group for Garden Planner database"
  subnet_ids  = data.aws_subnets.private.ids
  tags        = local.common_tags
}

# Security group for database access
resource "aws_security_group" "database" {
  name        = "${local.database_identifier}-sg"
  description = "Security group for Garden Planner database"
  vpc_id      = var.vpc_id

  ingress {
    description = "Database access from VPC"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
  }

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.common_tags
}

# IAM role for RDS monitoring
resource "aws_iam_role" "rds_monitoring_role" {
  name = "${local.database_identifier}-monitoring-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

# Attach RDS monitoring policy to role
resource "aws_iam_role_policy_attachment" "rds_monitoring_policy" {
  role       = aws_iam_role.rds_monitoring_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# Main database instance
resource "aws_db_instance" "database" {
  identifier     = local.database_identifier
  engine         = "sqlite"
  engine_version = "3.39.0"

  # Instance configuration
  instance_class        = var.instance_class
  allocated_storage     = 20
  max_allocated_storage = 100

  # Backup configuration
  backup_retention_period = var.backup_retention_days
  backup_window          = "03:00-04:00"
  maintenance_window     = "Mon:04:00-Mon:05:00"

  # High availability and networking
  multi_az               = false
  vpc_security_group_ids = [aws_security_group.database.id]
  db_subnet_group_name   = aws_db_subnet_group.database.name

  # Snapshot configuration
  skip_final_snapshot       = false
  final_snapshot_identifier = "${local.database_identifier}-final"

  # Performance and monitoring
  performance_insights_enabled          = true
  performance_insights_retention_period = 7
  monitoring_interval                   = 60
  monitoring_role_arn                  = aws_iam_role.rds_monitoring_role.arn
  enabled_cloudwatch_logs_exports      = ["error", "general", "slowquery"]

  # Maintenance and protection
  auto_minor_version_upgrade = true
  deletion_protection        = true

  tags = local.common_tags
}

# CloudWatch alarms for database monitoring
resource "aws_cloudwatch_metric_alarm" "database_cpu" {
  alarm_name          = "${local.database_identifier}-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic          = "Average"
  threshold          = "80"
  alarm_description  = "This metric monitors database CPU utilization"
  alarm_actions      = []

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.database.id
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "database_storage" {
  alarm_name          = "${local.database_identifier}-storage-space"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic          = "Average"
  threshold          = "5000000000" # 5GB in bytes
  alarm_description  = "This metric monitors free storage space"
  alarm_actions      = []

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.database.id
  }

  tags = local.common_tags
}