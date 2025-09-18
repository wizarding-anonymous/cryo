# Notification Service

Микросервис уведомлений для российской игровой платформы, построенный на NestJS + TypeScript.

## Возможности

- ✅ Уведомления в приложении
- ✅ Email уведомления через российских провайдеров
- ✅ Настройки уведомлений пользователя
- ✅ REST API для интеграции с другими микросервисами
- ✅ Кеширование с Redis
- ✅ PostgreSQL для хранения данных

## Технологический стек

- **Framework**: NestJS + TypeScript
- **База данных**: PostgreSQL 14+
- **Кеш**: Redis 7+
- **Тестирование**: Jest + Supertest
- **Контейнеризация**: Docker + Docker Compose

## Быстрый старт

### Предварительные требования

- Node.js 20+
- Docker и Docker Compose
- npm или yarn

### Установка

1. Клонируйте репозиторий и перейдите в директорию:
```bash
cd backend/notification-service
```

2. Установите зависимости:
```bash
npm install
```

3. Скопируйте файл окружения:
```bash
cp .env.example .env
```

4. Запустите базу данных и Redis:
```bash
npm run docker:dev
```

5. Запустите приложение в режиме разработки:
```bash
npm run start:dev
```

Приложение будет доступно по адресу: http://localhost:3000

## Docker

### Разработка

Запуск только базы данных и Redis для разработки:
```bash
npm run docker:dev
```

Остановка:
```bash
npm run docker:dev:down
```

### Полный стек

Запуск всего приложения в Docker:
```bash
npm run docker:up
```

Остановка:
```bash
npm run docker:down
```

## Тестирование

```bash
# Unit тесты
npm run test

# E2E тесты
npm run test:e2e

# Покрытие тестами
npm run test:cov

# Тесты в watch режиме
npm run test:watch
```

## Линтинг и форматирование

```bash
# Проверка кода
npm run lint

# Форматирование кода
npm run format
```

## API Документация

После запуска приложения, Swagger документация доступна по адресу:
http://localhost:3000/api

## Структура проекта

```
src/
├── app.module.ts          # Главный модуль приложения
├── main.ts               # Точка входа
├── notification/         # Модуль уведомлений
│   ├── controllers/      # REST контроллеры
│   ├── services/         # Бизнес-логика
│   ├── entities/         # TypeORM сущности
│   └── dto/             # Data Transfer Objects
├── database/            # Конфигурация базы данных
└── common/              # Общие утилиты и декораторы
```

## Переменные окружения

| Переменная | Описание | По умолчанию |
|------------|----------|--------------|
| `NODE_ENV` | Режим работы | `development` |
| `PORT` | Порт приложения | `3000` |
| `DATABASE_HOST` | Хост PostgreSQL | `localhost` |
| `DATABASE_PORT` | Порт PostgreSQL | `5433` |
| `DATABASE_USERNAME` | Пользователь БД | `notification_user` |
| `DATABASE_PASSWORD` | Пароль БД | `notification_password` |
| `DATABASE_NAME` | Имя БД | `notification_db` |
| `REDIS_HOST` | Хост Redis | `localhost` |
| `REDIS_PORT` | Порт Redis | `6380` |

## Интеграция с другими сервисами

Notification Service интегрируется со следующими MVP сервисами:

- **Payment Service** - уведомления о покупках
- **Social Service** - социальные уведомления
- **Achievement Service** - поздравления с достижениями
- **Review Service** - уведомления о новых отзывах
- **Game Catalog Service** - обновления игр
- **Library Service** - добавление игр в библиотеку

## Разработка

### Создание миграций

```bash
npm run migration:generate src/migrations/MigrationName
```

### Применение миграций

```bash
npm run migration:run
```

### Откат миграций

```bash
npm run migration:revert
```

## Производство

### Сборка

```bash
npm run build
```

### Запуск

```bash
npm run start:prod
```

## Мониторинг

- Health check: `GET /health`
- Metrics: `GET /metrics` (планируется)

## Лицензия

Частная лицензия