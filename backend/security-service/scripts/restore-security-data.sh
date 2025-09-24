#!/bin/bash

# Security Service Database Restore Script
# This script restores encrypted backups of critical security data

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/var/backups/security-service}"
ENCRYPTION_KEY_FILE="${ENCRYPTION_KEY_FILE:-/etc/security-service/backup.key}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-security_service}"
DB_USER="${DB_USER:-postgres}"

# Function to display usage
usage() {
    echo "Usage: $0 <backup_file> [options]"
    echo "Options:"
    echo "  --dry-run          Show what would be restored without actually doing it"
    echo "  --tables <list>    Comma-separated list of tables to restore (default: all)"
    echo "  --target-db <name> Target database name (default: ${DB_NAME})"
    echo ""
    echo "Example:"
    echo "  $0 security_service_20241225_120000.sql.gpg"
    echo "  $0 security_service_20241225_120000.sql.gpg --tables security_events,security_alerts"
    exit 1
}

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "${BACKUP_DIR}/restore.log"
}

# Parse command line arguments
BACKUP_FILE=""
DRY_RUN=false
TABLES_TO_RESTORE=""
TARGET_DB="${DB_NAME}"

while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --tables)
            TABLES_TO_RESTORE="$2"
            shift 2
            ;;
        --target-db)
            TARGET_DB="$2"
            shift 2
            ;;
        --help|-h)
            usage
            ;;
        *)
            if [[ -z "${BACKUP_FILE}" ]]; then
                BACKUP_FILE="$1"
            else
                echo "ERROR: Unknown option $1"
                usage
            fi
            shift
            ;;
    esac
done

# Validate arguments
if [[ -z "${BACKUP_FILE}" ]]; then
    echo "ERROR: Backup file not specified"
    usage
fi

# Check if backup file exists
FULL_BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILE}"
if [[ ! -f "${FULL_BACKUP_PATH}" ]]; then
    log "ERROR: Backup file not found: ${FULL_BACKUP_PATH}"
    exit 1
fi

# Check if encryption key exists
if [[ ! -f "${ENCRYPTION_KEY_FILE}" ]]; then
    log "ERROR: Encryption key file not found at ${ENCRYPTION_KEY_FILE}"
    exit 1
fi

log "Starting security service database restore"
log "Backup file: ${BACKUP_FILE}"
log "Target database: ${TARGET_DB}"
log "Dry run: ${DRY_RUN}"

# Verify backup integrity
log "Verifying backup integrity..."
gpg --batch --yes --quiet --decrypt \
    --passphrase-file "${ENCRYPTION_KEY_FILE}" \
    "${FULL_BACKUP_PATH}" > /dev/null || {
    log "ERROR: Backup verification failed - file may be corrupted"
    exit 1
}

log "Backup verification successful"

# Create temporary directory for restore
TEMP_DIR=$(mktemp -d)
trap "rm -rf ${TEMP_DIR}" EXIT

# Decrypt backup
log "Decrypting backup..."
DECRYPTED_FILE="${TEMP_DIR}/$(basename ${BACKUP_FILE} .gpg)"
gpg --batch --yes --quiet --decrypt \
    --passphrase-file "${ENCRYPTION_KEY_FILE}" \
    --output "${DECRYPTED_FILE}" \
    "${FULL_BACKUP_PATH}" || {
    log "ERROR: Backup decryption failed"
    exit 1
}

log "Backup decrypted successfully"

# If dry run, just show what would be restored
if [[ "${DRY_RUN}" == "true" ]]; then
    log "DRY RUN - Showing backup contents:"
    PGPASSWORD="${DB_PASSWORD}" pg_restore \
        --list \
        --verbose \
        "${DECRYPTED_FILE}" || {
        log "ERROR: Failed to list backup contents"
        exit 1
    }
    log "DRY RUN completed - no changes made"
    exit 0
fi

# Confirm restore operation
echo "WARNING: This will restore data to database '${TARGET_DB}'"
echo "This operation may overwrite existing data!"
read -p "Are you sure you want to continue? (yes/no): " -r
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    log "Restore operation cancelled by user"
    exit 0
fi

# Create database backup before restore (safety measure)
SAFETY_BACKUP="${TEMP_DIR}/pre_restore_backup_$(date +%Y%m%d_%H%M%S).sql"
log "Creating safety backup before restore..."
PGPASSWORD="${DB_PASSWORD}" pg_dump \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "${TARGET_DB}" \
    --format=custom \
    --file="${SAFETY_BACKUP}" || {
    log "WARNING: Failed to create safety backup"
}

# Perform restore
log "Starting database restore..."

if [[ -n "${TABLES_TO_RESTORE}" ]]; then
    # Restore specific tables
    IFS=',' read -ra TABLE_ARRAY <<< "${TABLES_TO_RESTORE}"
    for table in "${TABLE_ARRAY[@]}"; do
        log "Restoring table: ${table}"
        PGPASSWORD="${DB_PASSWORD}" pg_restore \
            -h "${DB_HOST}" \
            -p "${DB_PORT}" \
            -U "${DB_USER}" \
            -d "${TARGET_DB}" \
            --verbose \
            --clean \
            --if-exists \
            --table="${table}" \
            "${DECRYPTED_FILE}" || {
            log "ERROR: Failed to restore table ${table}"
            exit 1
        }
    done
else
    # Restore all tables
    log "Restoring all tables from backup..."
    PGPASSWORD="${DB_PASSWORD}" pg_restore \
        -h "${DB_HOST}" \
        -p "${DB_PORT}" \
        -U "${DB_USER}" \
        -d "${TARGET_DB}" \
        --verbose \
        --clean \
        --if-exists \
        "${DECRYPTED_FILE}" || {
        log "ERROR: Database restore failed"
        exit 1
    }
fi

# Verify restore
log "Verifying restore..."
RESTORED_TABLES=$(PGPASSWORD="${DB_PASSWORD}" psql \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "${TARGET_DB}" \
    -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('security_events', 'security_alerts', 'ip_blocks');" | tr -d ' ')

if [[ "${RESTORED_TABLES}" -ge 1 ]]; then
    log "Restore verification successful - ${RESTORED_TABLES} security tables found"
else
    log "WARNING: Restore verification failed - security tables may not be properly restored"
fi

# Update statistics
log "Updating database statistics..."
PGPASSWORD="${DB_PASSWORD}" psql \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "${TARGET_DB}" \
    -c "ANALYZE;" || {
    log "WARNING: Failed to update database statistics"
}

# Record restore metadata
cat >> "${BACKUP_DIR}/restore_metadata.json" << EOF
{
  "timestamp": "$(date '+%Y-%m-%d %H:%M:%S')",
  "backup_file": "${BACKUP_FILE}",
  "target_database": "${TARGET_DB}",
  "tables_restored": "${TABLES_TO_RESTORE:-all}",
  "safety_backup": "$(basename ${SAFETY_BACKUP})",
  "status": "success"
}
EOF

# Send notification (if configured)
if [[ -n "${RESTORE_NOTIFICATION_WEBHOOK:-}" ]]; then
    curl -X POST "${RESTORE_NOTIFICATION_WEBHOOK}" \
        -H "Content-Type: application/json" \
        -d "{
            \"service\": \"security-service\",
            \"action\": \"restore\",
            \"status\": \"success\",
            \"timestamp\": \"$(date '+%Y-%m-%d %H:%M:%S')\",
            \"backup_file\": \"${BACKUP_FILE}\",
            \"target_database\": \"${TARGET_DB}\"
        }" || {
        log "WARNING: Restore notification failed"
    }
fi

log "Database restore completed successfully"
log "Safety backup created at: ${SAFETY_BACKUP}"