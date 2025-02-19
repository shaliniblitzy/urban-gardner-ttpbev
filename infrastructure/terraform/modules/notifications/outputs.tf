# Output the Firebase project number for FCM configuration
output "firebase_project_number" {
  value       = google_firebase_project.main.project_number
  description = "The Firebase project number used for FCM configuration"
}

# Output the FCM server key for notification service authentication
output "fcm_server_key" {
  value       = google_apikeys_key.fcm_api_key.key_string
  description = "The Firebase Cloud Messaging server key for authentication"
  sensitive   = true
}