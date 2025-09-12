# Library Service

Микросервис для управления библиотеками пользователей в российской игровой платформе. Обеспечивает просмотр купленных игр, поиск, историю покупок и интеграцию с другими микросервисами через REST API.

## Технологический стек

- **Framework**: NestJS + TypeScript
- **База данных**: PostgreSQL 14+ (primary), Redis (cache)
- **ORM**: TypeORM
- **Тестирование**: Jest + Supertest
- **Документация**: Swagger/OpenAPI
- **Контейнеризация**: Docker + Kubernetes

## Установка и настройка

### 1. Установка зависимостей

```bash
npm install
```

### 2. Настройка окружения

Скопируйте файл `.env.example` в `.env` и настройте переменные окружения:

```bash
cp .env.example .env
```

### 3. Настройка базы данных

Убедитесь, что PostgreSQL и Redis запущены и доступны по указанным в `.env` адресам.

## Запуск приложения

```bash
# development
npm run start

# watch mode (рекомендуется для разработки)
npm run start:dev

# debug mode
npm run start:debug

# production mode
npm run start:prod
```

После запуска сервис будет доступен по адресу:
- API: http://localhost:3000/api
- Swagger документация: http://localhost:3000/api/docs
- Health check: http://localhost:3000/api/health

## Тестирование

```bash
# unit тесты
npm run test

# unit тесты с отслеживанием изменений
npm run test:watch

# unit тесты с покрытием кода
npm run test:cov

# e2e тесты
npm run test:e2e

# e2e тесты с покрытием
npm run test:e2e:cov

# все тесты с покрытием
npm run test:all

# тесты для CI/CD
npm run test:ci
```

Цель покрытия тестами: **100%**

## Линтинг и форматирование

```bash
# проверка кода
npm run lint

# форматирование кода
npm run format
```

## API Endpoints

### Библиотека пользователя
- `GET /api/library/my` - Получить библиотеку текущего пользователя
- `GET /api/library/my/search` - Поиск в библиотеке
- `GET /api/library/ownership/:gameId` - Проверить владение игрой

### История покупок
- `GET /api/library/history` - История покупок
- `GET /api/library/history/search` - Поиск в истории
- `GET /api/library/history/:purchaseId` - Детали покупки

### Служебные endpoints
- `GET /api/health` - Health check
- `GET /api/health/detailed` - Детальный health check

### Internal API (для интеграции между сервисами)
- `POST /api/library/add` - Добавить игру в библиотеку
- `DELETE /api/library/remove` - Удалить игру из библиотеки

## Архитектура

Сервис следует модульной архитектуре NestJS:

```
src/
├── config/           # Конфигурация и валидация окружения
├── library/          # Модуль библиотеки
├── history/          # Модуль истории покупок
├── health/           # Модуль health checks
├── app.module.ts     # Главный модуль приложения
└── main.ts          # Точка входа приложения
```

## Интеграции

Сервис интегрируется с другими микросервисами через REST API:

- **Payment Service** - получение уведомлений о покупках
- **Game Catalog Service** - обогащение данных об играх
- **User Service** - валидация пользователей
- **Download Service** - проверка прав на скачивание

## Переменные окружения

Основные переменные окружения (см. `.env.example`):

- `PORT` - порт приложения (по умолчанию 3000)
- `DATABASE_*` - настройки PostgreSQL
- `REDIS_*` - настройки Redis
- `JWT_*` - настройки JWT токенов
- `*_SERVICE_URL` - URL других микросервисов

## Docker

```bash
# Сборка образа
docker build -t library-service .

# Запуск контейнера
docker run -p 3000:3000 --env-file .env library-service
```

## Разработка

### Создание новых модулей

```bash
npx nest generate module <module-name>
npx nest generate controller <controller-name>
npx nest generate service <service-name>
```

### Миграции базы данных

```bash
# Создание миграции
npm run migration:create -- <migration-name>

# Запуск миграций
npm run migration:run

# Откат миграций
npm run migration:revert
```

## Мониторинг и логирование

- Health checks доступны по `/api/health`
- Метрики Prometheus (планируется)
- Structured logging с Winston (планируется)

## Лицензия

Proprietary - Российская игровая платформа