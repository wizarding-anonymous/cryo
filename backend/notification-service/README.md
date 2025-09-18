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
├── app.controller.ts     # Контроллер health-check
├── app.module.ts         # Главный модуль
├── main.ts               # Точка входа
├── auth/                 # Логика аутентификации
│   └── jwt-auth.guard.ts # Защитник эндпоинтов
├── common/               # Общие модули
│   └── enums/            # Перечисления (enum)
├── database/             # Конфигурация БД и миграции
├── entities/             # Сущности TypeORM
└── notification/         # Основной модуль уведомлений
    ├── dto/              # Data Transfer Objects
    ├── templates/        # HTML-шаблоны для email
    ├── notification.controller.ts
    ├── notification.module.ts
    ├── notification.service.ts
    └── email.service.ts
```

## Переменные окружения

| Переменная | Описание | По умолчанию в .env.example |
|--------------------|----------------------------------------------------------|--------------------------------------|
| `NODE_ENV` | Режим работы (`development` или `production`) | `development` |
| `PORT` | Порт, на котором запускается приложение | `3000` |
| `CORS_ORIGIN` | Разрешенный источник для CORS | `*` |
| `JWT_SECRET` | Секретный ключ для валидации JWT токенов | `your-super-secret-jwt-key...` |
| `DB_HOST` | Хост базы данных PostgreSQL | `localhost` |
| `DB_PORT` | Порт базы данных PostgreSQL | `5432` |
| `DB_USERNAME` | Имя пользователя для подключения к БД | `user` |
| `DB_PASSWORD` | Пароль для подключения к БД | `password` |
| `DB_DATABASE` | Название базы данных | `notification_db` |
| `REDIS_HOST` | Хост Redis | `localhost` |
| `REDIS_PORT` | Порт Redis | `6379` |
| `USER_SERVICE_URL` | URL микросервиса пользователей для интеграции | `http://localhost:3001` |
| `MAILER_URL` | URL API провайдера для отправки email | `https://api.examplemailer.com/send` |
| `MAILER_API_KEY` | Ключ API для провайдера email | `your-mailer-api-key` |
| `MAILER_FROM_EMAIL`| Email-адрес отправителя | `noreply@myplatform.com` |

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