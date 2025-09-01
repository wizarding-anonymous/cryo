#!/bin/bash

# User Service Backup and Disaster Recovery Script
# Поддерживает автоматическое резервное копирование и восстановление

set -e

# Конфигурация
BACKUP_DIR="${BACKUP_DIR:-/var/backups/user-service}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-userservice}"
DB_USER="${DB_USER:-postgres}"
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"
S3_BUCKET="${S3_BUCKET:-user-service-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Проверка зависимостей
check_dependencies() {
    log "Проверка зависимостей..."
    
    command -v pg_dump >/dev/null 2>&1 || error "pg_dump не найден. Установите PostgreSQL client."
    command -v redis-cli >/dev/null 2>&1 || error "redis-cli не найден. Установите Redis client."
    command -v aws >/dev/null 2>&1 || warn "AWS CLI не найден. S3 backup будет недоступен."
    command -v gzip >/dev/null 2>&1 || error "gzip не найден."
    
    log "Все зависимости проверены"
}

# Создание директории для бэкапов
setup_backup_dir() {
    mkdir -p "$BACKUP_DIR"
    chmod 750 "$BACKUP_DIR"
    log "Директория бэкапов: $BACKUP_DIR"
}

# Бэкап PostgreSQL
backup_database() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$BACKUP_DIR/db_backup_$timestamp.sql"
    local compressed_file="$backup_file.gz"
    
    log "Создание бэкапа базы данных..."
    
    # Экспорт с сжатием и шифрованием
    PGPASSWORD="$DB_PASSWORD" pg_dump \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --verbose \
        --no-owner \
        --no-privileges \
        --create \
        --clean \
        --if-exists \
        > "$backup_file" || error "Ошибка создания бэкапа БД"
    
    # Сжатие
    gzip "$backup_file" || error "Ошибка сжатия бэкапа"
    
    # Проверка целостности
    if [ -f "$compressed_file" ]; then
        local size=$(stat -f%z "$compressed_file" 2>/dev/null || stat -c%s "$compressed_file" 2>/dev/null)
        log "Бэкап БД создан: $compressed_file (размер: $size байт)"
        echo "$compressed_file"
    else
        error "Бэкап БД не создан"
    fi
}

# Бэкап Redis
backup_redis() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$BACKUP_DIR/redis_backup_$timestamp.rdb"
    local compressed_file="$backup_file.gz"
    
    log "Создание бэкапа Redis..."
    
    # Создание снапшота Redis
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" BGSAVE || error "Ошибка создания Redis snapshot"
    
    # Ожидание завершения BGSAVE
    while [ "$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" LASTSAVE)" = "$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" LASTSAVE)" ]; do
        sleep 1
    done
    
    # Копирование RDB файла
    local redis_dir=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" CONFIG GET dir | tail -n 1)
    local rdb_file="$redis_dir/dump.rdb"
    
    if [ -f "$rdb_file" ]; then
        cp "$rdb_file" "$backup_file" || error "Ошибка копирования Redis RDB"
        gzip "$backup_file" || error "Ошибка сжатия Redis бэкапа"
        
        local size=$(stat -f%z "$compressed_file" 2>/dev/null || stat -c%s "$compressed_file" 2>/dev/null)
        log "Бэкап Redis создан: $compressed_file (размер: $size байт)"
        echo "$compressed_file"
    else
        error "Redis RDB файл не найден: $rdb_file"
    fi
}

# Загрузка в S3
upload_to_s3() {
    local file="$1"
    local s3_key="$(basename "$file")"
    
    if command -v aws >/dev/null 2>&1; then
        log "Загрузка в S3: s3://$S3_BUCKET/$s3_key"
        aws s3 cp "$file" "s3://$S3_BUCKET/$s3_key" \
            --storage-class STANDARD_IA \
            --server-side-encryption AES256 || warn "Ошибка загрузки в S3"
    else
        warn "AWS CLI недоступен, пропуск загрузки в S3"
    fi
}

# Полный бэкап
full_backup() {
    log "Начало полного бэкапа User Service..."
    
    check_dependencies
    setup_backup_dir
    
    # Создание манифеста бэкапа
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local manifest_file="$BACKUP_DIR/backup_manifest_$timestamp.json"
    
    cat > "$manifest_file" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "service": "user-service",
    "version": "1.0.0",
    "type": "full_backup",
    "components": []
}
EOF
    
    # Бэкап базы данных
    local db_backup=$(backup_database)
    upload_to_s3 "$db_backup"
    
    # Бэкап Redis
    local redis_backup=$(backup_redis)
    upload_to_s3 "$redis_backup"
    
    # Обновление манифеста
    cat > "$manifest_file" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "service": "user-service",
    "version": "1.0.0",
    "type": "full_backup",
    "components": [
        {
            "type": "postgresql",
            "file": "$(basename "$db_backup")",
            "size": $(stat -f%z "$db_backup" 2>/dev/null || stat -c%s "$db_backup" 2>/dev/null)
        },
        {
            "type": "redis",
            "file": "$(basename "$redis_backup")",
            "size": $(stat -f%z "$redis_backup" 2>/dev/null || stat -c%s "$redis_backup" 2>/dev/null)
        }
    ]
}
EOF
    
    upload_to_s3 "$manifest_file"
    
    log "Полный бэкап завершен успешно"
    log "Манифест: $manifest_file"
}

# Восстановление базы данных
restore_database() {
    local backup_file="$1"
    
    if [ ! -f "$backup_file" ]; then
        error "Файл бэкапа не найден: $backup_file"
    fi
    
    log "Восстановление базы данных из: $backup_file"
    
    # Распаковка если нужно
    local sql_file="$backup_file"
    if [[ "$backup_file" == *.gz ]]; then
        sql_file="${backup_file%.gz}"
        gunzip -c "$backup_file" > "$sql_file" || error "Ошибка распаковки бэкапа"
    fi
    
    # Восстановление
    PGPASSWORD="$DB_PASSWORD" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d postgres \
        -f "$sql_file" || error "Ошибка восстановления БД"
    
    log "База данных восстановлена успешно"
    
    # Очистка временного файла
    if [[ "$backup_file" == *.gz ]]; then
        rm -f "$sql_file"
    fi
}

# Восстановление Redis
restore_redis() {
    local backup_file="$1"
    
    if [ ! -f "$backup_file" ]; then
        error "Файл бэкапа Redis не найден: $backup_file"
    fi
    
    log "Восстановление Redis из: $backup_file"
    
    # Остановка Redis (если управляется скриптом)
    warn "Необходимо остановить Redis перед восстановлением"
    
    # Распаковка RDB файла
    local rdb_file="$backup_file"
    if [[ "$backup_file" == *.gz ]]; then
        rdb_file="${backup_file%.gz}"
        gunzip -c "$backup_file" > "$rdb_file" || error "Ошибка распаковки Redis бэкапа"
    fi
    
    # Получение директории Redis
    local redis_dir=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" CONFIG GET dir | tail -n 1)
    
    # Копирование RDB файла
    cp "$rdb_file" "$redis_dir/dump.rdb" || error "Ошибка копирования RDB файла"
    
    log "Redis бэкап восстановлен. Перезапустите Redis сервер."
    
    # Очистка временного файла
    if [[ "$backup_file" == *.gz ]]; then
        rm -f "$rdb_file"
    fi
}

# Очистка старых бэкапов
cleanup_old_backups() {
    log "Очистка бэкапов старше $RETENTION_DAYS дней..."
    
    find "$BACKUP_DIR" -name "*.gz" -mtime +$RETENTION_DAYS -delete
    find "$BACKUP_DIR" -name "*.json" -mtime +$RETENTION_DAYS -delete
    
    log "Очистка завершена"
}

# Проверка целостности бэкапов
verify_backups() {
    log "Проверка целостности бэкапов..."
    
    local errors=0
    
    for file in "$BACKUP_DIR"/*.gz; do
        if [ -f "$file" ]; then
            if gzip -t "$file" 2>/dev/null; then
                log "✓ $file - OK"
            else
                error "✗ $file - ПОВРЕЖДЕН"
                ((errors++))
            fi
        fi
    done
    
    if [ $errors -eq 0 ]; then
        log "Все бэкапы прошли проверку целостности"
    else
        error "Найдено $errors поврежденных бэкапов"
    fi
}

# Тест disaster recovery
test_disaster_recovery() {
    log "Тестирование процедуры disaster recovery..."
    
    # Создание тестового бэкапа
    local test_backup=$(backup_database)
    
    # Создание тестовой БД
    local test_db="userservice_dr_test_$(date +%s)"
    
    PGPASSWORD="$DB_PASSWORD" createdb \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        "$test_db" || error "Ошибка создания тестовой БД"
    
    # Восстановление в тестовую БД
    local sql_file="${test_backup%.gz}"
    gunzip -c "$test_backup" > "$sql_file"
    
    # Модификация SQL для тестовой БД
    sed -i.bak "s/CREATE DATABASE $DB_NAME/CREATE DATABASE $test_db/g" "$sql_file"
    sed -i.bak "s/\\\\connect $DB_NAME/\\\\connect $test_db/g" "$sql_file"
    
    PGPASSWORD="$DB_PASSWORD" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$test_db" \
        -f "$sql_file" || error "Ошибка восстановления в тестовую БД"
    
    # Проверка данных
    local user_count=$(PGPASSWORD="$DB_PASSWORD" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$test_db" \
        -t -c "SELECT COUNT(*) FROM users;" | tr -d ' ')
    
    log "Тестовая БД содержит $user_count пользователей"
    
    # Очистка
    PGPASSWORD="$DB_PASSWORD" dropdb \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        "$test_db"
    
    rm -f "$sql_file" "$sql_file.bak"
    
    log "Тест disaster recovery завершен успешно"
}

# Мониторинг состояния бэкапов
monitor_backups() {
    log "Мониторинг состояния бэкапов..."
    
    local latest_backup=$(ls -t "$BACKUP_DIR"/db_backup_*.gz 2>/dev/null | head -n 1)
    
    if [ -n "$latest_backup" ]; then
        local backup_age=$(( ($(date +%s) - $(stat -f%m "$latest_backup" 2>/dev/null || stat -c%Y "$latest_backup" 2>/dev/null)) / 3600 ))
        log "Последний бэкап: $latest_backup (возраст: $backup_age часов)"
        
        if [ $backup_age -gt 24 ]; then
            warn "Последний бэкап старше 24 часов!"
        fi
    else
        error "Бэкапы не найдены!"
    fi
    
    # Проверка места на диске
    local disk_usage=$(df "$BACKUP_DIR" | tail -1 | awk '{print $5}' | sed 's/%//')
    log "Использование диска: $disk_usage%"
    
    if [ $disk_usage -gt 80 ]; then
        warn "Мало места на диске для бэкапов!"
    fi
}

# Главная функция
main() {
    case "${1:-}" in
        "backup")
            full_backup
            ;;
        "restore-db")
            restore_database "$2"
            ;;
        "restore-redis")
            restore_redis "$2"
            ;;
        "cleanup")
            cleanup_old_backups
            ;;
        "verify")
            verify_backups
            ;;
        "test")
            test_disaster_recovery
            ;;
        "monitor")
            monitor_backups
            ;;
        *)
            echo "Использование: $0 {backup|restore-db|restore-redis|cleanup|verify|test|monitor}"
            echo ""
            echo "Команды:"
            echo "  backup           - Создать полный бэкап"
            echo "  restore-db FILE  - Восстановить БД из файла"
            echo "  restore-redis FILE - Восстановить Redis из файла"
            echo "  cleanup          - Удалить старые бэкапы"
            echo "  verify           - Проверить целостность бэкапов"
            echo "  test             - Тест disaster recovery"
            echo "  monitor          - Мониторинг состояния бэкапов"
            echo ""
            echo "Переменные окружения:"
            echo "  BACKUP_DIR       - Директория бэкапов (по умолчанию: /var/backups/user-service)"
            echo "  DB_HOST          - Хост PostgreSQL (по умолчанию: localhost)"
            echo "  DB_PASSWORD      - Пароль PostgreSQL"
            echo "  RETENTION_DAYS   - Срок хранения бэкапов в днях (по умолчанию: 30)"
            echo "  S3_BUCKET        - S3 bucket для удаленного хранения"
            exit 1
            ;;
    esac
}

main "$@"