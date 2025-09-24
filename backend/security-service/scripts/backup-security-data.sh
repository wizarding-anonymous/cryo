#!/bin/bash

# Security Service Database Backup Script
# This script creates encrypted backups of critical security data

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/var/backups/security-service}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
ENCRYPTION_KEY_FILE="${ENCRYPTION_KEY_FILE:-/etc/security-service/backup.key}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-security_service}"
DB_USER="${DB_USER:-postgres}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="security_service_${TIMESTAMP}.sql"
ENCRYPTED_BACKUP_FILE="${BACKUP_FILE}.gpg"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "${BACKUP_DIR}/backup.log"
}

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

log "Starting security service database backup"

# Check if encryption key exists
if [[ ! -f "${ENCRYPTION_KEY_FILE}" ]]; then
    log "ERROR: Encryption key file not found at ${ENCRYPTION_KEY_FILE}"
    exit 1
fi

# Create database dump with specific security tables
log "Creating database dump..."
PGPASSWORD="${DB_PASSWORD}" pg_dump \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    --verbose \
    --no-owner \
    --no-privileges \
    --format=custom \
    --compress=9 \
    --table=security_events \
    --table=security_alerts \
    --table=ip_blocks \
    --file="${BACKUP_DIR}/${BACKUP_FILE}" || {
    log "ERROR: Database dump failed"
    exit 1
}

log "Database dump completed: ${BACKUP_FILE}"

# Encrypt the backup
log "Encrypting backup..."
gpg --batch --yes --cipher-algo AES256 --compress-algo 2 --symmetric \
    --passphrase-file "${ENCRYPTION_KEY_FILE}" \
    --output "${BACKUP_DIR}/${ENCRYPTED_BACKUP_FILE}" \
    "${BACKUP_DIR}/${BACKUP_FILE}" || {
    log "ERROR: Backup encryption failed"
    exit 1
}

# Remove unencrypted backup
rm -f "${BACKUP_DIR}/${BACKUP_FILE}"
log "Backup encrypted and original removed: ${ENCRYPTED_BACKUP_FILE}"

# Verify backup integrity
log "Verifying backup integrity..."
gpg --batch --yes --quiet --decrypt \
    --passphrase-file "${ENCRYPTION_KEY_FILE}" \
    "${BACKUP_DIR}/${ENCRYPTED_BACKUP_FILE}" > /dev/null || {
    log "ERROR: Backup verification failed"
    exit 1
}

log "Backup verification successful"

# Calculate backup size and checksum
BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${ENCRYPTED_BACKUP_FILE}" | cut -f1)
BACKUP_CHECKSUM=$(sha256sum "${BACKUP_DIR}/${ENCRYPTED_BACKUP_FILE}" | cut -d' ' -f1)

log "Backup completed successfully:"
log "  File: ${ENCRYPTED_BACKUP_FILE}"
log "  Size: ${BACKUP_SIZE}"
log "  SHA256: ${BACKUP_CHECKSUM}"

# Record backup metadata
cat >> "${BACKUP_DIR}/backup_metadata.json" << EOF
{
  "timestamp": "${TIMESTAMP}",
  "filename": "${ENCRYPTED_BACKUP_FILE}",
  "size": "${BACKUP_SIZE}",
  "checksum": "${BACKUP_CHECKSUM}",
  "tables": ["security_events", "security_alerts", "ip_blocks"],
  "retention_until": "$(date -d "+${RETENTION_DAYS} days" '+%Y-%m-%d')"
}
EOF

# Clean up old backups
log "Cleaning up backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "security_service_*.sql.gpg" -mtime +${RETENTION_DAYS} -delete
find "${BACKUP_DIR}" -name "backup.log" -mtime +90 -delete  # Keep logs for 90 days

# Upload to remote storage (if configured)
if [[ -n "${BACKUP_REMOTE_URL:-}" ]]; then
    log "Uploading backup to remote storage..."
    case "${BACKUP_REMOTE_URL}" in
        s3://*)
            aws s3 cp "${BACKUP_DIR}/${ENCRYPTED_BACKUP_FILE}" "${BACKUP_REMOTE_URL}/" || {
                log "WARNING: Remote upload to S3 failed"
            }
            ;;
        gs://*)
            gsutil cp "${BACKUP_DIR}/${ENCRYPTED_BACKUP_FILE}" "${BACKUP_REMOTE_URL}/" || {
                log "WARNING: Remote upload to GCS failed"
            }
            ;;
        *)
            log "WARNING: Unsupported remote storage URL: ${BACKUP_REMOTE_URL}"
            ;;
    esac
fi

# Send notification (if configured)
if [[ -n "${BACKUP_NOTIFICATION_WEBHOOK:-}" ]]; then
    curl -X POST "${BACKUP_NOTIFICATION_WEBHOOK}" \
        -H "Content-Type: application/json" \
        -d "{
            \"service\": \"security-service\",
            \"status\": \"success\",
            \"timestamp\": \"${TIMESTAMP}\",
            \"backup_file\": \"${ENCRYPTED_BACKUP_FILE}\",
            \"size\": \"${BACKUP_SIZE}\",
            \"checksum\": \"${BACKUP_CHECKSUM}\"
        }" || {
        log "WARNING: Backup notification failed"
    }
fi

log "Backup process completed successfully"