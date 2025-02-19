# Provider configurations
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.0"
    }
  }
}

# Create monitoring namespace
resource "kubernetes_namespace" "monitoring" {
  metadata {
    name = "monitoring"
    labels = {
      environment = var.environment
      managed-by  = "terraform"
      app         = "garden-planner-monitoring"
    }
  }
}

# Deploy Prometheus using Helm
resource "helm_release" "prometheus" {
  name       = "prometheus"
  namespace  = kubernetes_namespace.monitoring.metadata[0].name
  repository = "https://prometheus-community.github.io/helm-charts"
  chart      = "prometheus"
  version    = "15.0.0"

  values = [
    yamlencode({
      server = {
        retention        = "15d"
        scrapeInterval  = "30s"
        evaluationInterval = "30s"
        
        resources = {
          requests = {
            cpu    = "250m"
            memory = "512Mi"
          }
          limits = {
            cpu    = "500m"
            memory = "1Gi"
          }
        }

        persistentVolume = {
          enabled = true
          size    = "50Gi"
        }
      }

      alertmanager = {
        enabled = true
        config  = file("${path.module}/../../monitoring/alertmanager.yml")
      }

      configmapReload = {
        prometheus = {
          enabled = true
        }
      }

      extraScrapeConfigs = file("${path.module}/../../monitoring/prometheus.yml")
    })
  ]

  depends_on = [kubernetes_namespace.monitoring]
}

# Deploy Grafana using Helm
resource "helm_release" "grafana" {
  name       = "grafana"
  namespace  = kubernetes_namespace.monitoring.metadata[0].name
  repository = "https://grafana.github.io/helm-charts"
  chart      = "grafana"
  version    = "6.50.0"

  values = [
    yamlencode({
      adminPassword = var.grafana_admin_password

      persistence = {
        enabled = true
        size    = "10Gi"
      }

      datasources = {
        "datasources.yaml" = {
          apiVersion = 1
          datasources = [
            {
              name      = "Prometheus"
              type      = "prometheus"
              url       = "http://prometheus-server"
              access    = "proxy"
              isDefault = true
            }
          ]
        }
      }

      dashboardProviders = {
        "dashboardproviders.yaml" = {
          apiVersion = 1
          providers = [
            {
              name            = "default"
              orgId           = 1
              folder         = ""
              type           = "file"
              disableDeletion = false
              editable       = true
              options = {
                path = "/var/lib/grafana/dashboards"
              }
            }
          ]
        }
      }

      dashboards = {
        default = {
          "garden-planner" = {
            json = file("${path.module}/../../monitoring/grafana-dashboard.json")
          }
        }
      }

      resources = {
        requests = {
          cpu    = "100m"
          memory = "256Mi"
        }
        limits = {
          cpu    = "200m"
          memory = "512Mi"
        }
      }
    })
  ]

  depends_on = [kubernetes_namespace.monitoring, helm_release.prometheus]
}

# Deploy AlertManager using Helm
resource "helm_release" "alertmanager" {
  name       = "alertmanager"
  namespace  = kubernetes_namespace.monitoring.metadata[0].name
  repository = "https://prometheus-community.github.io/helm-charts"
  chart      = "alertmanager"
  version    = "0.24.0"

  values = [
    yamlencode({
      config = file("${path.module}/../../monitoring/alertmanager.yml")

      resources = {
        requests = {
          cpu    = "100m"
          memory = "128Mi"
        }
        limits = {
          cpu    = "200m"
          memory = "256Mi"
        }
      }

      persistence = {
        enabled = true
        size    = "5Gi"
      }
    })
  ]

  depends_on = [kubernetes_namespace.monitoring, helm_release.prometheus]
}

# Export monitoring endpoints
output "prometheus_endpoint" {
  value       = "http://prometheus-server.${kubernetes_namespace.monitoring.metadata[0].name}.svc.cluster.local:9090"
  description = "Prometheus server endpoint URL"
}

output "grafana_endpoint" {
  value       = "http://grafana.${kubernetes_namespace.monitoring.metadata[0].name}.svc.cluster.local:3000"
  description = "Grafana dashboard endpoint URL"
}

output "alertmanager_endpoint" {
  value       = "http://alertmanager.${kubernetes_namespace.monitoring.metadata[0].name}.svc.cluster.local:9093"
  description = "AlertManager endpoint URL"
}