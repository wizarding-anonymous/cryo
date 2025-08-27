# User Service Operations Runbook

## 1. Service Overview
- **Service Name**: User Service
- **Description**: Manages all user-related data, authentication, authorization, and profiles.
- **Port**: `3000`
- **Health Check Endpoint**: `GET /health`
- **Metrics Endpoint**: `GET /metrics`

## 2. Deployment Procedures

### Deploy to Staging
- **Trigger**: Push or merge to the `develop` branch.
- **Action**: The `deploy-staging` job in the CI/CD pipeline is automatically triggered.
- **Command**: `kubectl set image deployment/user-service user-service=user-service:{image_tag}`
- **Verification**: `kubectl rollout status deployment/user-service -n staging`

### Deploy to Production
- **Trigger**: Push or merge to the `main` branch.
- **Action**: The `deploy-production` job in the CI/CD pipeline is automatically triggered.
- **Command**: `helm upgrade user-service ./helm/user-service --namespace production --set image.tag={image_tag}`
- **Verification**: `helm status user-service -n production`

## 3. Monitoring & Alerts
- **Grafana Dashboard**: [User Service Dashboard](https://monitoring.gaming-platform.ru/d/user-service)
- **Alerting Channel**: Slack `#alerts-user-service`
- **Primary Logs Access**: `kubectl logs -f deployment/user-service`

## 4. Common Issues & Resolutions

### High Memory Usage / Memory Leak
1.  **Diagnose**: Check pod memory usage with `kubectl top pods`.
2.  **Action**: Perform a rolling restart to temporarily mitigate: `kubectl rollout restart deployment/user-service`.
3.  **Investigate**: Analyze memory dumps if the issue persists.

### High CPU Usage
1.  **Diagnose**: Check pod CPU usage with `kubectl top pods`.
2.  **Action**: If under heavy load, increase the number of replicas: `kubectl scale deployment/user-service --replicas=5`.
3.  **Investigate**: Profile the application for CPU-intensive operations.

### Database Connection Issues
1.  **Diagnose**: Check the status of the PostgreSQL cluster and the `/health` endpoint.
2.  **Action**: Check network policies and database connection pool settings.
3.  **Escalate**: Contact the on-call DBA if the database itself is unresponsive.

### Kafka Integration Issues
1.  **Diagnose**: Check consumer lag using the Grafana dashboard or `kafka-consumer-groups.sh`.
2.  **Action**: Restart the `user-service` deployment to re-establish consumer connections.
3.  **Investigate**: Check for "poison pill" messages in the topic or schema compatibility issues.

## 5. Emergency Procedures

### Rollback to Previous Version
- **Command**: `helm rollback user-service {revision_number-1}`
- **Reason**: To revert a faulty deployment.

### Emergency Scaling
- **Command**: `kubectl scale deployment/user-service --replicas=10`
- **Reason**: To handle unexpected, massive traffic spikes.

### Database Failover
- **Process**: This is an automated process managed by the cloud provider's database service.
- **Manual Trigger**: If automation fails, follow the cloud provider's documentation for promoting a read replica.
