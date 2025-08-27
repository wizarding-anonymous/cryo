# Disaster Recovery Plan - User Service

## 1. Backup Strategy

### PostgreSQL Database
- **Frequency**: Full backup daily at 02:00 UTC. Incremental backups every 6 hours.
- **Retention**: 30 days for full backups, 7 days for incremental. Backups are stored in a separate geo-redundant cloud storage bucket.
- **Tooling**: `pg_dump` for full backups, `pg_basebackup` and WAL archiving for point-in-time recovery.

### Redis Cache
- **Frequency**: RDB snapshots every 15 minutes.
- **AOF (Append Only File)**: Enabled to ensure minimal data loss between snapshots.
- **Tooling**: Standard Redis persistence mechanisms.

### Configuration & Code
- **Configuration**: All `.yaml`, `.json`, and environment configuration files are stored in the Git repository.
- **Code**: The codebase is version-controlled in Git.

## 2. Recovery Procedures

### Full Service Outage (Primary Region Failure)
1.  **Failover Trigger**: Automated monitoring detects failure of the primary region's health checks.
2.  **DNS Update**: DNS records are automatically updated to point to the secondary region's load balancer.
3.  **Database Failover**: The PostgreSQL read replica in the secondary region is promoted to primary.
4.  **Service Activation**: Services in the secondary region become active and handle all incoming traffic.
5.  **Verification**: Engineers perform manual checks to ensure all systems are operational.

### Database Corruption
1.  **Isolate Database**: The corrupted database instance is taken offline.
2.  **Restore**: The latest known good full backup is restored to a new instance.
3.  **Apply Logs**: Write-Ahead Logs (WAL) are replayed to recover data up to the point just before the corruption occurred.
4.  **Redirect Traffic**: The application is pointed to the newly restored database instance.

## 3. RTO/RPO Targets

- **RTO (Recovery Time Objective)**: **15 minutes**. The maximum acceptable time for the service to be unavailable after a disaster.
- **RPO (Recovery Point Objective)**: **5 minutes**. The maximum acceptable amount of data loss, measured in time. This is covered by the combination of Redis AOF and PostgreSQL WAL archiving.
