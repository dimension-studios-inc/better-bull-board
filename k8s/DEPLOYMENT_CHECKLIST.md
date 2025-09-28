# Kubernetes Deployment Checklist

Use this checklist to ensure a smooth deployment of Better Bull Board on Kubernetes.

## Pre-Deployment

### ✅ Infrastructure Setup
- [ ] Kubernetes cluster is running and accessible
- [ ] kubectl is configured and can connect to the cluster
- [ ] Ingress controller (nginx-ingress) is installed
- [ ] Cert-manager is installed (optional, for SSL)
- [ ] AWS CLI is configured with appropriate permissions

### ✅ EBS Volumes
- [ ] Created PostgreSQL EBS volume (10GB recommended)
- [ ] Created ClickHouse EBS volume (20GB recommended)  
- [ ] Created Redis EBS volume (5GB recommended)
- [ ] Noted down volume IDs for configuration

### ✅ Docker Images
- [ ] Built and pushed PostgreSQL image to ECR
- [ ] Built and pushed ClickHouse image to ECR
- [ ] Built and pushed App image to ECR
- [ ] Built and pushed Ingest image to ECR

## Configuration Updates

### ✅ Volume Configuration
- [ ] Updated `k8s/04-postgres-pv.yaml` with PostgreSQL volume ID
- [ ] Updated `k8s/09-clickhouse-pv.yaml` with ClickHouse volume ID
- [ ] Updated `k8s/12-redis-pv.yaml` with Redis volume ID

### ✅ Image Registry
- [ ] Updated `k8s/05-postgres-deployment.yaml` with PostgreSQL image URL
- [ ] Updated `k8s/10-clickhouse-deployment.yaml` with ClickHouse image URL
- [ ] Updated `k8s/17-app-deployment.yaml` with App image URL
- [ ] Updated `k8s/21-ingest-deployment.yaml` with Ingest image URL

### ✅ Domain and URLs
- [ ] Updated `k8s/15-app-configmap.yaml` with your domain
- [ ] Updated `k8s/23-ingress.yaml` with your domain
- [ ] Configured DNS to point to your ingress controller

### ✅ Secrets
- [ ] Updated `k8s/03-postgres-secret.yaml` with secure database password
- [ ] Updated `k8s/08-clickhouse-secret.yaml` with secure ClickHouse password
- [ ] Updated `k8s/16-app-secret.yaml` with:
  - [ ] Admin email
  - [ ] Admin password
  - [ ] JWT secret key

## Deployment Steps

### ✅ Deploy Configuration
```bash
kubectl apply -f k8s/01-namespace.yaml
kubectl apply -f k8s/02-postgres-configmap.yaml
kubectl apply -f k8s/03-postgres-secret.yaml
kubectl apply -f k8s/07-clickhouse-configmap.yaml
kubectl apply -f k8s/08-clickhouse-secret.yaml
kubectl apply -f k8s/15-app-configmap.yaml
kubectl apply -f k8s/16-app-secret.yaml
kubectl apply -f k8s/20-ingest-configmap.yaml
```

### ✅ Deploy Storage
```bash
kubectl apply -f k8s/04-postgres-pv.yaml
kubectl apply -f k8s/09-clickhouse-pv.yaml
kubectl apply -f k8s/12-redis-pv.yaml
```

### ✅ Deploy Stateful Services
```bash
kubectl apply -f k8s/05-postgres-deployment.yaml
kubectl apply -f k8s/06-postgres-service.yaml
kubectl apply -f k8s/10-clickhouse-deployment.yaml
kubectl apply -f k8s/11-clickhouse-service.yaml
kubectl apply -f k8s/13-redis-deployment.yaml
kubectl apply -f k8s/14-redis-service.yaml
```

### ✅ Wait for Databases
```bash
kubectl wait --for=condition=ready pod -l app=postgres -n better-bull-board --timeout=300s
kubectl wait --for=condition=ready pod -l app=clickhouse -n better-bull-board --timeout=300s
kubectl wait --for=condition=ready pod -l app=redis -n better-bull-board --timeout=300s
```

### ✅ Deploy Application Services
```bash
kubectl apply -f k8s/17-app-deployment.yaml
kubectl apply -f k8s/18-app-service.yaml
kubectl apply -f k8s/19-app-hpa.yaml
kubectl apply -f k8s/21-ingest-deployment.yaml
kubectl apply -f k8s/22-ingest-service.yaml
```

### ✅ Deploy Networking
```bash
kubectl apply -f k8s/23-ingress.yaml
```

## Post-Deployment Verification

### ✅ Pod Status
- [ ] All pods are running: `kubectl get pods -n better-bull-board`
- [ ] No pods are in CrashLoopBackOff or Error state
- [ ] All services are available: `kubectl get services -n better-bull-board`

### ✅ Connectivity Tests
- [ ] PostgreSQL is accessible from other pods
- [ ] ClickHouse is accessible from other pods
- [ ] Redis is accessible from other pods
- [ ] App service responds to HTTP requests
- [ ] Ingest service accepts WebSocket connections

### ✅ Application Tests
- [ ] Web application loads at your domain
- [ ] Admin login works with configured credentials
- [ ] Dashboard displays without errors
- [ ] Job queues are visible (if any exist)

### ✅ Monitoring
- [ ] Check resource usage: `kubectl top pods -n better-bull-board`
- [ ] Verify HPA is working: `kubectl get hpa -n better-bull-board`
- [ ] Check ingress status: `kubectl get ingress -n better-bull-board`

## Troubleshooting Commands

If something goes wrong:

```bash
# Check pod status and events
kubectl get pods -n better-bull-board
kubectl describe pod <pod-name> -n better-bull-board

# Check logs
kubectl logs -f deployment/app -n better-bull-board
kubectl logs -f deployment/ingest -n better-bull-board

# Check events
kubectl get events -n better-bull-board --sort-by='.lastTimestamp'

# Port forward for testing
kubectl port-forward service/app-service 3000:3000 -n better-bull-board
```

## Security Checklist

### ✅ Production Security
- [ ] Changed all default passwords
- [ ] JWT secret is random and secure
- [ ] Network policies are configured (optional)
- [ ] RBAC is properly configured
- [ ] TLS/SSL certificates are valid
- [ ] Container images are scanned for vulnerabilities

## Backup and Maintenance

### ✅ Backup Setup
- [ ] Database backup strategy is in place
- [ ] Persistent volume snapshots are configured
- [ ] Backup restoration procedure is tested

### ✅ Monitoring and Alerts
- [ ] Resource monitoring is configured
- [ ] Log aggregation is set up
- [ ] Alerting for critical failures is configured
- [ ] Performance monitoring is in place

---

**Date Completed:** ___________  
**Deployed By:** ___________  
**Environment:** ___________  
**Notes:** ___________