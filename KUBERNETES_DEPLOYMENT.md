# Better Bull Board - Kubernetes Deployment Guide

This guide will help you deploy the Better Bull Board application on Kubernetes with all required components.

## Architecture Overview

The application consists of the following components:
- **PostgreSQL**: Database with custom extensions (pgvector, PostGIS, pg_uuidv7)
- **ClickHouse**: Analytics database for storing job metrics and logs
- **Redis**: Queue management and caching
- **App**: Next.js frontend application (scalable)
- **Ingest**: Background service for data ingestion

## Prerequisites

Before deploying, ensure you have:

1. **Kubernetes cluster** running (EKS recommended for AWS)
2. **kubectl** configured to connect to your cluster
3. **Docker images** built and pushed to your registry (see [Docker Build Guide](#docker-build-guide))
4. **Persistent volumes** created in AWS (EBS volumes)
5. **Ingress controller** installed (nginx-ingress recommended)
6. **Cert-manager** installed (optional, for SSL certificates)

## Quick Start

### 1. Prepare EBS Volumes

Create EBS volumes for persistent storage:

```bash
# Create EBS volumes
aws ec2 create-volume --size 10 --volume-type gp2 --availability-zone your-az --tag-specifications 'ResourceType=volume,Tags=[{Key=Name,Value=postgres-pv}]'
aws ec2 create-volume --size 20 --volume-type gp2 --availability-zone your-az --tag-specifications 'ResourceType=volume,Tags=[{Key=Name,Value=clickhouse-pv}]'
aws ec2 create-volume --size 5 --volume-type gp2 --availability-zone your-az --tag-specifications 'ResourceType=volume,Tags=[{Key=Name,Value=redis-pv}]'
```

Update the volume IDs in the PV configuration files:
- `k8s/04-postgres-pv.yaml`
- `k8s/09-clickhouse-pv.yaml`
- `k8s/12-redis-pv.yaml`

### 2. Update Configuration

Before deploying, update the following configuration files:

#### Image Registry
Update all deployment files with your actual Docker registry URLs:
- `k8s/05-postgres-deployment.yaml`
- `k8s/10-clickhouse-deployment.yaml`
- `k8s/17-app-deployment.yaml`
- `k8s/21-ingest-deployment.yaml`

Replace `your-registry` with your actual registry (e.g., `123456789.dkr.ecr.us-west-2.amazonaws.com`).

#### Domain Configuration
Update the domain in these files:
- `k8s/15-app-configmap.yaml`: Update `WEBSOCKET_URL`
- `k8s/23-ingress.yaml`: Update the host field

#### Secrets
Update the secrets in these files with your actual values:
- `k8s/03-postgres-secret.yaml`: Database password
- `k8s/08-clickhouse-secret.yaml`: ClickHouse password
- `k8s/16-app-secret.yaml`: Admin credentials and JWT secret

### 3. Deploy the Application

Deploy the components in order:

```bash
# Create namespace and configure secrets/configmaps
kubectl apply -f k8s/01-namespace.yaml
kubectl apply -f k8s/02-postgres-configmap.yaml
kubectl apply -f k8s/03-postgres-secret.yaml
kubectl apply -f k8s/07-clickhouse-configmap.yaml
kubectl apply -f k8s/08-clickhouse-secret.yaml
kubectl apply -f k8s/15-app-configmap.yaml
kubectl apply -f k8s/16-app-secret.yaml
kubectl apply -f k8s/20-ingest-configmap.yaml

# Create persistent volumes
kubectl apply -f k8s/04-postgres-pv.yaml
kubectl apply -f k8s/09-clickhouse-pv.yaml
kubectl apply -f k8s/12-redis-pv.yaml

# Deploy stateful services
kubectl apply -f k8s/05-postgres-deployment.yaml
kubectl apply -f k8s/06-postgres-service.yaml
kubectl apply -f k8s/10-clickhouse-deployment.yaml
kubectl apply -f k8s/11-clickhouse-service.yaml
kubectl apply -f k8s/13-redis-deployment.yaml
kubectl apply -f k8s/14-redis-service.yaml

# Wait for databases to be ready
kubectl wait --for=condition=ready pod -l app=postgres -n better-bull-board --timeout=300s
kubectl wait --for=condition=ready pod -l app=clickhouse -n better-bull-board --timeout=300s
kubectl wait --for=condition=ready pod -l app=redis -n better-bull-board --timeout=300s

# Deploy application services
kubectl apply -f k8s/17-app-deployment.yaml
kubectl apply -f k8s/18-app-service.yaml
kubectl apply -f k8s/19-app-hpa.yaml
kubectl apply -f k8s/21-ingest-deployment.yaml
kubectl apply -f k8s/22-ingest-service.yaml

# Create ingress
kubectl apply -f k8s/23-ingress.yaml
```

### 4. Verify Deployment

Check the status of all components:

```bash
# Check all pods
kubectl get pods -n better-bull-board

# Check services
kubectl get services -n better-bull-board

# Check ingress
kubectl get ingress -n better-bull-board

# Check logs if needed
kubectl logs -f deployment/app -n better-bull-board
kubectl logs -f deployment/ingest -n better-bull-board
```

## Scaling

The application supports horizontal scaling:

```bash
# Scale the app manually
kubectl scale deployment app --replicas=3 -n better-bull-board

# The HPA will automatically scale based on CPU/memory usage
kubectl get hpa -n better-bull-board
```

## Monitoring and Troubleshooting

### Common Issues

1. **Pods stuck in Pending**: Check if PVs are available and correctly configured
2. **Database connection errors**: Verify service names and credentials
3. **Ingress not working**: Ensure ingress controller is installed and domain is configured

### Useful Commands

```bash
# Get all resources
kubectl get all -n better-bull-board

# Describe a problematic pod
kubectl describe pod <pod-name> -n better-bull-board

# Check events
kubectl get events -n better-bull-board --sort-by='.lastTimestamp'

# Port forward for testing
kubectl port-forward service/app-service 3000:3000 -n better-bull-board
```

## Backup and Maintenance

### Database Backups

Set up regular backups for PostgreSQL and ClickHouse:

```bash
# PostgreSQL backup
kubectl exec -it deployment/postgres -n better-bull-board -- pg_dump -U postgres postgres > backup.sql

# ClickHouse backup (configure in production)
kubectl exec -it deployment/clickhouse -n better-bull-board -- clickhouse-client --query "BACKUP DATABASE default TO S3('s3://your-bucket/backup', 'access_key', 'secret_key')"
```

### Updates

To update the application:

1. Build and push new Docker images
2. Update the image tags in deployment files
3. Apply the updated configurations:

```bash
kubectl apply -f k8s/17-app-deployment.yaml
kubectl apply -f k8s/21-ingest-deployment.yaml
```

## Security Considerations

1. **Use proper secrets management**: Consider using AWS Secrets Manager or Kubernetes secrets with encryption at rest
2. **Network policies**: Implement network policies to restrict communication between pods
3. **RBAC**: Set up proper role-based access control
4. **TLS**: Ensure all communication is encrypted (configure cert-manager for automatic SSL certificates)

## Production Recommendations

1. **Resource limits**: Adjust resource requests and limits based on your workload
2. **Monitoring**: Set up monitoring with Prometheus and Grafana
3. **Logging**: Configure centralized logging with ELK stack or similar
4. **Backup strategy**: Implement automated backup and disaster recovery procedures
5. **High availability**: Consider multi-AZ deployment for critical components