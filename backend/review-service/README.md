# Review Service

Микросервис для управления отзывами и рейтингами игр в российской игровой платформе.

## Описание

Review Service предоставляет API для создания, просмотра и управления отзывами пользователей на игры. Включает систему рейтингов и интеграцию с другими сервисами платформы.

## Технологический стек

- **Framework**: NestJS + TypeScript
- **Database**: PostgreSQL
- **Cache**: Redis
- **ORM**: TypeORM
- **Validation**: class-validator, class-transformer
- **Documentation**: Swagger/OpenAPI
- **Containerization**: Docker

## Быстрый старт

### Локальная разработка

1. **Установка зависимостей**
```bash
npm install
```

2. **Настройка окружения**
```bash
cp .env.example .env
# Отредактируйте .env файл под ваши настройки
```

3. **Запуск с Docker Compose (рекомендуется)**
```bash
npm run docker:dev
```

4. **Или запуск локально**
```bash
# Убедитесь что PostgreSQL и Redis запущены
npm run start:dev
```

### Доступные эндпоинты

- **API**: http://localhost:3003/api/v1
- **Swagger документация**: http://localhost:3003/api/docs
- **Health check**: http://localhost:3003/api/v1/health

## Разработка

### Команды

```bash
# Разработка
npm run start:dev          # Запуск в режиме разработки
npm run start:debug        # Запуск с отладкой

# Сборка
npm run build              # Сборка проекта
npm run start:prod         # Запуск production версии

# Тестирование
npm run test               # Unit тесты
npm run test:watch         # Тесты в watch режиме
npm run test:cov           # Тесты с покрытием
npm run test:e2e           # E2E тесты

# Линтинг и форматирование
npm run lint               # ESLint проверка
npm run format             # Prettier форматирование

# Docker
npm run docker:build       # Сборка Docker образа
npm run docker:dev         # Запуск с docker-compose
```

### Структура проекта

```
src/
├── config/                # Конфигурационные модули
│   ├── app.config.ts
│   ├── database.config.ts
│   ├── redis.config.ts
│   └── validation.config.ts
├── modules/               # Бизнес модули (будут добавлены)
├── common/                # Общие компоненты
├── app.controller.ts      # Основной контроллер
├── app.module.ts          # Основной модуль
├── app.service.ts         # Основной сервис
└── main.ts               # Точка входа
```

## Конфигурация

### Переменные окружения

```bash
# Приложение
NODE_ENV=development
PORT=3000

# База данных
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=review_user
DATABASE_PASSWORD=review_password
DATABASE_NAME=review_db

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-jwt-secret-key

# Внешние сервисы
LIBRARY_SERVICE_URL=http://localhost:3001
GAME_CATALOG_SERVICE_URL=http://localhost:3002
ACHIEVEMENT_SERVICE_URL=http://localhost:3004
NOTIFICATION_SERVICE_URL=http://localhost:3005
```

## Docker

### Development

```bash
docker-compose up --build
```

### Production

```bash
docker build -t review-service .
docker run -p 3000:3000 review-service
```

## API Документация

После запуска сервиса, Swagger документация доступна по адресу:
http://localhost:3003/api/docs

## Мониторинг

### Health Check

```bash
curl http://localhost:3003/api/v1/health
```

Ответ:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "review-service",
  "version": "1.0.0",
  "environment": "development"
}
```

## Следующие шаги

1. Настройка базы данных и создание entities
2. Реализация бизнес-логики отзывов
3. Создание REST API контроллеров
4. Интеграция с внешними сервисами
5. Добавление тестов

## Лицензия

Частная лицензия - Российская игровая платформа