# Prometheus endpoint URL output
output "prometheus_url" {
  value       = "http://${helm_release.prometheus.name}.${var.environment}.local"
  description = "URL for accessing Prometheus web interface"
  sensitive   = false
}

# Grafana endpoint URL output
output "grafana_url" {
  value       = "http://${helm_release.grafana.name}.${var.environment}.local"
  description = "URL for accessing Grafana dashboards"
  sensitive   = false
}

# AlertManager endpoint URL output
output "alertmanager_url" {
  value       = "http://${helm_release.alertmanager.name}.${var.environment}.local"
  description = "URL for accessing AlertManager interface"
  sensitive   = false
}

# Monitoring namespace output
output "monitoring_namespace" {
  value       = "monitoring"
  description = "Kubernetes namespace containing monitoring stack"
  sensitive   = false
}