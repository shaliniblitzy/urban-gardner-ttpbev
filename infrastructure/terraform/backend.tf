terraform {
  backend "s3" {
    # Primary state storage bucket
    bucket = "garden-planner-terraform-state"
    key    = "${var.environment}/terraform.tfstate"
    region = var.aws_region
    
    # Authentication and encryption
    profile = var.aws_profile
    encrypt = true
    
    # State locking using DynamoDB
    dynamodb_table = "garden-planner-terraform-locks"
    
    # Versioning configuration
    versioning = true
    
    # Server-side encryption configuration
    server_side_encryption_configuration {
      rule {
        apply_server_side_encryption_by_default {
          sse_algorithm     = "aws:kms"
          kms_master_key_id = "aws/s3"
        }
      }
    }

    # Lifecycle rules for state file versions
    lifecycle_rule {
      enabled = true
      
      noncurrent_version_expiration {
        days = 90
      }
    }

    # Cross-region replication for disaster recovery
    replication_configuration {
      role = "arn:aws:iam::ACCOUNT-ID:role/terraform-state-replication-role"
      
      rules {
        id     = "backup-to-secondary-region"
        status = "Enabled"
        
        destination {
          bucket        = "arn:aws:s3:::garden-planner-terraform-state-backup"
          storage_class = "STANDARD"
        }
      }
    }
  }
}