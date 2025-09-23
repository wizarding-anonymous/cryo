# Social Service

Social Service для российской игровой платформы MVP. Обеспечивает базовые социальные функции: система друзей, простые сообщения и онлайн статусы.

## Технологический стек

- **Framework**: NestJS + TypeScript
- **База данных**: PostgreSQL + Redis
- **ORM**: TypeORM
- **Тестирование**: Jest + Supertest
- **Документация**: Swagger/OpenAPI

## Установка

```bash
# Установка зависимостей
npm install

# Копирование конфигурации
cp .env.example .env
```

## Запуск

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

## Тестирование

```bash
# Unit тесты
npm run test

# E2E тесты
npm run test:e2e

# Покрытие тестами
npm run test:cov
```

## API Документация

После запуска сервиса документация доступна по адресу:
http://localhost:3003/api/docs

## Структура проекта

```
src/
├── modules/
│   ├── friends/          # Система друзей
│   ├── messages/         # Простые сообщения
│   └── status/           # Онлайн статусы
├── app.module.ts         # Главный модуль
└── main.ts              # Точка входа
```

## MVP Функции (Месяц 3)

- ✅ Система друзей (заявки, принятие, удаление)
- ✅ Простые сообщения между друзьями
- ✅ Онлайн статусы (онлайн/офлайн/отошел)
- ✅ REST API для интеграции с другими сервисами
- ✅ Docker готовность

## Интеграции

- User Service - получение данных пользователей
- Notification Service - уведомления о социальных событиях
- Achievement Service - социальные достижения
- Review Service - проверка социальных связей