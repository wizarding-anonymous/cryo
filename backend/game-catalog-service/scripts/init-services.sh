#!/bin/bash
# Game Catalog Service Initialization Script
# Идемпотентный скрипт для настройки всех зависимостей

set -e

print_status() { echo -e "\033[0;32m[INFO]\033[0m $1"; }
print_error() { echo -e "\033[0;31m[ERROR]\033[0m $1"; }

# 1. Проверка переменных окружения
validate_env() {
    print_status "Validating environment variables..."
    if [ -z "$POSTGRES_HOST" ]; then
        print_error "POSTGRES_HOST is not set."
        exit 1
    fi
    if [ -z "$ELASTICSEARCH_NODE" ]; then
        print_error "ELASTICSEARCH_NODE is not set."
        exit 1
    fi
    if [ -z "$S3_ENDPOINT" ]; then
        print_error "S3_ENDPOINT is not set."
        exit 1
    fi
    if [ -z "$KAFKA_BROKERS" ]; then
        print_error "KAFKA_BROKERS is not set."
        exit 1
    fi
    print_status "Environment variables seem to be set."
}

# 2. Инициализация PostgreSQL
init_database() {
    print_status "Initializing PostgreSQL..."
    print_status "Running database migrations..."
    npm run migration:run
    print_status "Database migrations completed."
}

# 3. Настройка Elasticsearch
init_elasticsearch() {
    print_status "Setting up Elasticsearch..."
    # Placeholder: В реальном проекте здесь будет логика для создания индексов и маппингов
    # Пример:
    # curl -X PUT "$ELASTICSEARCH_NODE/games" -H 'Content-Type: application/json' --data-binary "@path/to/es-mapping.json"
    print_status "Elasticsearch setup skipped (placeholder)."
}

# 4. Настройка S3/MinIO
init_s3() {
    print_status "Setting up S3 storage..."
    # Placeholder: В реальном проекте здесь будет логика для создания бакета
    # Пример с AWS CLI:
    # aws s3api create-bucket --bucket $S3_BUCKET --region $S3_REGION --endpoint-url $S3_ENDPOINT
    print_status "S3 setup skipped (placeholder)."
}

# 5. Настройка Kafka
init_kafka() {
    print_status "Setting up Kafka topics..."
    # Placeholder: В реальном проекте здесь будет логика для создания топиков
    # Пример с kafkacat:
    # kafkacat -b $KAFKA_BROKERS -L -t game.published || kafkacat -b $KAFKA_BROKERS -C 1 -t game.published -c 1
    print_status "Kafka setup skipped (placeholder)."
}

# 6. Настройка Redis
init_redis() {
    print_status "Testing Redis connection..."
    # Placeholder: В реальном проекте здесь можно проверить подключение
    # Пример:
    # redis-cli -h $REDIS_HOST -p $REDIS_PORT ping
    print_status "Redis connection test skipped (placeholder)."
}

# Основная функция
main() {
    print_status "Starting Game Catalog Service initialization..."

    # Загрузка переменных из .env файла если он есть
    if [ -f .env ]; then
      export $(cat .env | sed 's/#.*//g' | xargs)
    fi

    validate_env
    init_database
    init_elasticsearch
    init_s3
    init_kafka
    init_redis

    print_status "✅ Initialization completed successfully!"
}

main "$@"
