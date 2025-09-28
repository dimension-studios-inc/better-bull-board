# Better Bull Board - Kubernetes Deployment Guide

This guide will help you deploy the Better Bull Board application on Kubernetes with all required components.

## Architecture Overview

The application consists of the following components:
- **PostgreSQL**: Database with custom extensions (pgvector, PostGIS, pg_uuidv7)
- **ClickHouse**: Analytics database for storing job metrics and logs
- **Redis (external)**: Queue management and caching
- **App**: Next.js frontend application (scalable)
- **Ingest**: Background service for data ingestion

## Prerequisites

Before deploying, ensure you have:

1. **Kubernetes cluster** running (EKS recommended for AWS)
2. **kubectl** configured to connect to your cluster
3. **Ingress controller** installed (nginx-ingress recommended)
4. **Cert-manager** installed (optional, for SSL certificates)
5. **External Redis/Dragonfly** installed (Redis is used for queue management and caching)

## Quick Start

### 3. Deploy the Application

Deploy the components in order:

```bash
# Create namespace and configure secrets/configmaps
kubectl apply -f k8s/
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

Only the app service is scalable. The ingest service is not scalable.
