# Payment Service

Микросервис платежей для российской игровой платформы. Обеспечивает обработку платежей, интеграцию с российскими платежными провайдерами и управление заказами.

## 📋 Описание

Payment Service - это ключевой микросервис, отвечающий за обработку всех платежных операций в игровой платформе. Он предоставляет функциональность создания заказов, обработки платежей через российских провайдеров (Сбербанк, ЮMoney, Т-Банк), управления статусами платежей и интеграции с другими микросервисами. Сервис построен на NestJS с использованием TypeScript и интегрирован с PostgreSQL для хранения данных и Redis для кэширования.

## 🚀 Основной функционал

### Управление заказами
- ✅ Создание заказов на покупку игр
- ✅ Валидация игр через Game Catalog Service
- ✅ Проверка доступности игр для покупки
- ✅ Управление статусами заказов (pending, paid, cancelled, expired)
- ✅ Автоматическое истечение неоплаченных заказов

### Обработка платежей
- ✅ Создание платежей для заказов
- ✅ Интеграция с российскими платежными провайдерами
- ✅ Обработка webhook'ов от провайдеров
- ✅ Управление статусами платежей (pending, processing, completed, failed, cancelled)
- ✅ Симуляция платежей для MVP (mock режим)

### Платежные провайдеры
- ✅ **Сбербанк Онлайн** - интеграция с API Сбербанка
- ✅ **ЮMoney (Яндекс.Деньги)** - интеграция с API ЮMoney
- ✅ **Т-Банк (Тинькофф)** - интеграция с API Т-Банка
- ✅ Mock провайдеры для тестирования и разработки
- ✅ Единый интерфейс для всех провайдеров

### Безопасность и мониторинг
- ✅ JWT аутентификация и авторизация
- ✅ Валидация webhook'ов от провайдеров
- ✅ Rate limiting для защиты от злоупотреблений
- ✅ Prometheus метрики для мониторинга
- ✅ Структурированное логирование платежных операций
- ✅ Health checks для всех компонентов

### Интеграции
- ✅ **Game Catalog Service** - валидация и получение информации об играх
- ✅ **Library Service** - добавление купленных игр в библиотеку
- ✅ **User Service** - аутентификация пользователей
- ✅ Кэширование с Redis для оптимизации производительности
- ✅ Event-driven архитектура для уведомлений

## 🔄 Payment Flows

### 1. Создание заказа
```
Пользователь → POST /orders → Валидация игры (Game Catalog) → 
Проверка доступности → Создание заказа → Установка времени истечения → 
Возврат данных заказа
```

### 2. Создание платежа
```
Пользователь → POST /payments → Валидация заказа → 
Выбор провайдера → Создание платежа → Возврат данных платежа
```

### 3. Обработка платежа
```
Пользователь → POST /payments/:id/process → Обращение к провайдеру → 
Получение URL для оплаты → Обновление статуса → Возврат URL оплаты
```

### 4. Webhook от провайдера
```
Провайдер → POST /webhooks/:provider → Валидация подписи → 
Обновление статуса платежа → Обновление статуса заказа → 
Добавление игры в библиотеку (Library Service) → Отправка уведомления
```

### 5. Подтверждение платежа
```
Система → Получение webhook → Валидация платежа → 
Обновление статуса на 'completed' → Обновление заказа на 'paid' → 
Вызов Library Service → Логирование операции
```

### 6. Отмена платежа
```
Пользователь/Система → POST /payments/:id/cancel → 
Обращение к провайдеру → Отмена платежа → 
Обновление статусов → Логирование операции
```

## 🛠 API Эндпоинты

### Orders (`/orders`)

| Метод | Эндпоинт | Описание | Аутентификация |
|-------|----------|----------|----------------|
| `POST` | `/orders` | Создание нового заказа | ✅ JWT |
| `GET` | `/orders` | Получение списка заказов пользователя | ✅ JWT |
| `GET` | `/orders/:id` | Получение заказа по ID | ✅ JWT |

#### POST /orders
**Описание:** Создание нового заказа на покупку игры
**Headers:** `Authorization: Bearer <jwt_token>`
**Body:**
```json
{
  "gameId": "550e8400-e29b-41d4-a716-446655440000"
}
```
**Ответ:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "userId": "user-uuid",
    "gameId": "550e8400-e29b-41d4-a716-446655440000",
    "gameName": "Cyberpunk 2077",
    "amount": "1999.00",
    "currency": "RUB",
    "status": "pending",
    "expiresAt": "2024-01-01T01:00:00.000Z",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Payments (`/payments`)

| Метод | Эндпоинт | Описание | Аутентификация |
|-------|----------|----------|----------------|
| `POST` | `/payments` | Создание платежа для заказа | ✅ JWT |
| `POST` | `/payments/:id/process` | Обработка платежа | ✅ JWT |
| `GET` | `/payments/:id` | Получение информации о платеже | ✅ JWT |
| `POST` | `/payments/:id/confirm` | Подтверждение платежа | ✅ JWT |
| `POST` | `/payments/:id/cancel` | Отмена платежа | ✅ JWT |

#### POST /payments
**Описание:** Создание платежа для существующего заказа
**Headers:** `Authorization: Bearer <jwt_token>`
**Body:**
```json
{
  "orderId": "550e8400-e29b-41d4-a716-446655440001",
  "provider": "sberbank"
}
```
**Ответ:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440002",
    "orderId": "550e8400-e29b-41d4-a716-446655440001",
    "amount": "1999.00",
    "currency": "RUB",
    "provider": "sberbank",
    "status": "pending",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### POST /payments/:id/process
**Описание:** Обработка платежа через выбранного провайдера
**Headers:** `Authorization: Bearer <jwt_token>`
**Ответ:**
```json
{
  "success": true,
  "data": {
    "paymentUrl": "https://securepayments.sberbank.ru/payment/merchants/...",
    "externalId": "sber_1234567890_abcd1234",
    "status": "processing"
  }
}
```

### Webhooks (`/webhooks`)

| Метод | Эндпоинт | Описание | Аутентификация |
|-------|----------|----------|----------------|
| `POST` | `/webhooks/:provider` | Обработка webhook от провайдера | ❌ (подпись) |

#### POST /webhooks/sberbank
**Описание:** Webhook от Сбербанка о статусе платежа
**Body:**
```json
{
  "orderNumber": "sber_1234567890_abcd1234",
  "orderStatus": 2,
  "amount": 199900,
  "currency": "RUB",
  "signature": "webhook_signature"
}
```

### Mock Payment Forms (`/mock`)

| Метод | Эндпоинт | Описание | Аутентификация |
|-------|----------|----------|----------------|
| `GET` | `/mock/sberbank/payment-form/:paymentId` | Mock форма оплаты Сбербанк | ❌ |
| `GET` | `/mock/ymoney/payment-form/:paymentId` | Mock форма оплаты ЮMoney | ❌ |
| `GET` | `/mock/tbank/payment-form/:paymentId` | Mock форма оплаты Т-Банк | ❌ |
| `POST` | `/mock/*/process/:paymentId` | Обработка mock платежа | ❌ |

### Health Check (`/health`)

| Метод | Эндпоинт | Описание | Аутентификация |
|-------|----------|----------|----------------|
| `GET` | `/health` | Полная проверка здоровья сервиса | ❌ |
| `GET` | `/health/ready` | Проверка готовности сервиса | ❌ |
| `GET` | `/health/live` | Проверка жизнеспособности сервиса | ❌ |

### Metrics (`/metrics`)

| Метод | Эндпоинт | Описание | Аутентификация |
|-------|----------|----------|----------------|
| `GET` | `/metrics` | Prometheus метрики | ❌ |

### Admin (`/admin`)

| Метод | Эндпоинт | Описание | Аутентификация |
|-------|----------|----------|----------------|
| `POST` | `/admin/payment-simulation/force-success/:paymentId` | Принудительное завершение платежа | ✅ Admin |
| `POST` | `/admin/payment-simulation/force-failure/:paymentId` | Принудительная ошибка платежа | ✅ Admin |

## 🏗 Архитектура

### Технологический стек
- **Framework:** NestJS (Node.js)
- **Language:** TypeScript
- **Database:** PostgreSQL
- **Cache:** Redis
- **Authentication:** JWT (JSON Web Tokens)
- **Validation:** class-validator, class-transformer
- **Documentation:** Swagger/OpenAPI
- **Logging:** Winston
- **Metrics:** Prometheus
- **Testing:** Jest + Supertest

### Структура проекта
```
src/
├── modules/
│   ├── order/              # Модуль заказов
│   │   ├── dto/           # DTO для заказов
│   │   ├── entities/      # TypeORM сущности
│   │   ├── order.controller.ts
│   │   └── order.service.ts
│   └── payment/           # Модуль платежей
│       ├── dto/          # DTO для платежей
│       ├── entities/     # TypeORM сущности
│       ├── providers/    # Платежные провайдеры
│       ├── interfaces/   # Интерфейсы провайдеров
│       ├── payment.controller.ts
│       ├── payment.service.ts
│       └── webhook.controller.ts
├── integrations/          # Внешние интеграции
│   ├── game-catalog/     # Интеграция с Game Catalog Service
│   └── library/          # Интеграция с Library Service
├── common/               # Общие компоненты
│   ├── auth/            # Аутентификация и авторизация
│   ├── interceptors/    # Interceptors
│   ├── filters/         # Exception filters
│   ├── enums/           # Перечисления
│   └── decorators/      # Декораторы
├── config/              # Конфигурация
├── database/            # Миграции БД
└── main.ts             # Точка входа
```

### Платежные провайдеры
```
src/modules/payment/providers/
├── sberbank.provider.ts    # Сбербанк Онлайн
├── ymoney.provider.ts      # ЮMoney
├── tinkoff.provider.ts     # Т-Банк
└── interfaces/
    └── payment-provider.interface.ts
```

## 🚀 Установка и запуск

### Предварительные требования
- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- Docker (опционально)

### Локальная разработка

1. **Клонирование репозитория:**
```bash
git clone <repository-url>
cd backend/payment-service
```

2. **Установка зависимостей:**
```bash
npm install
```

3. **Настройка переменных окружения:**
```bash
cp .env.example .env
# Отредактируйте .env файл с вашими настройками
```

4. **Запуск базы данных и Redis:**
```bash
# Используя Docker Compose
docker-compose up -d postgres-payment-db redis-cache

# Или запустите локально установленные сервисы
```

5. **Запуск миграций:**
```bash
npm run migration:run
```

6. **Запуск в режиме разработки:**
```bash
npm run start:dev
```

Сервис будет доступен по адресу: `http://localhost:3005`

### Docker

1. **Сборка образа:**
```bash
docker build -t payment-service .
```

2. **Запуск с Docker Compose:**
```bash
docker-compose up -d
```

3. **Просмотр логов:**
```bash
docker-compose logs -f payment-service
```

### Продакшн

1. **Сборка приложения:**
```bash
npm run build
```

2. **Запуск в продакшн режиме:**
```bash
npm run start:prod
```

## 🧪 Тестирование

### Запуск тестов
```bash
# Unit тесты
npm run test

# E2E тесты
npm run test:e2e

# Тесты с покрытием
npm run test:cov

# Тесты в watch режиме
npm run test:watch
```

### Результаты тестирования
- ✅ **Unit тесты:** 174 тестов пройдено
- ✅ **E2E тесты:** 45 тестов пройдено
- ✅ **Покрытие кода:** Все основные компоненты покрыты
- ✅ **Интеграционные тесты:** PostgreSQL и Redis

### Нагрузочное тестирование
```bash
cd load-test
# Следуйте инструкциям в load-test/README.md
```

## 📊 Мониторинг

### Health Checks
- **Основной:** `GET /health` - проверка всех компонентов
- **Готовность:** `GET /health/ready` - готовность к обслуживанию запросов
- **Жизнеспособность:** `GET /health/live` - базовая проверка работоспособности

### Метрики Prometheus
Доступны по адресу: `http://localhost:3005/metrics`

**Основные метрики:**
- `payment_service_payments_total` - общее количество платежей
- `payment_service_payments_by_provider` - платежи по провайдерам
- `payment_service_payment_duration` - время обработки платежей
- `payment_service_orders_total` - общее количество заказов
- `payment_service_webhook_requests_total` - количество webhook запросов

### Логирование
- **Структурированные логи** в JSON формате (продакшн)
- **Отдельные файлы логов:**
  - `application.log` - общие логи приложения
  - `payments.log` - логи платежных операций
  - `errors.log` - логи ошибок
  - `audit.log` - аудит критических операций
- **Correlation ID** для трассировки запросов

## 🔧 Конфигурация

### Основные переменные окружения

| Переменная | Описание | По умолчанию |
|------------|----------|--------------|
| `NODE_ENV` | Окружение | `development` |
| `PORT` | Порт сервиса | `3005` |
| `POSTGRES_HOST` | Хост PostgreSQL | `localhost` |
| `POSTGRES_PORT` | Порт PostgreSQL | `5432` |
| `REDIS_HOST` | Хост Redis | `localhost` |
| `REDIS_PORT` | Порт Redis | `6379` |
| `JWT_SECRET` | Секрет для JWT | - |
| `PAYMENT_MODE` | Режим платежей | `simulation` |
| `PAYMENT_AUTO_APPROVE` | Автоподтверждение | `true` |
| `PAYMENT_SUCCESS_RATE` | Процент успешных платежей | `0.95` |

### Платежные провайдеры

| Переменная | Описание |
|------------|----------|
| `ENABLED_PROVIDERS` | Активные провайдеры | `sberbank,yandex,tbank` |
| `SBERBANK_MOCK_URL` | URL mock Сбербанка | - |
| `SBERBANK_MOCK_API_KEY` | API ключ mock Сбербанка | - |
| `YANDEX_MOCK_URL` | URL mock ЮMoney | - |
| `YANDEX_MOCK_API_KEY` | API ключ mock ЮMoney | - |
| `TBANK_MOCK_URL` | URL mock Т-Банка | - |
| `TBANK_MOCK_API_KEY` | API ключ mock Т-Банка | - |

### Интеграции с сервисами

| Переменная | Описание | По умолчанию |
|------------|----------|--------------|
| `USER_SERVICE_URL` | URL User Service | `http://user-service:3001` |
| `GAME_CATALOG_SERVICE_URL` | URL Game Catalog Service | `http://game-catalog-service:3002` |
| `LIBRARY_SERVICE_URL` | URL Library Service | `http://library-service:3000` |
| `SERVICE_TIMEOUT_MS` | Таймаут запросов к сервисам | `5000` |
| `RETRY_ATTEMPTS` | Количество повторных попыток | `3` |

## 🔗 Интеграции

### Внешние сервисы
- **Game Catalog Service:** Валидация игр и получение информации о ценах
- **Library Service:** Добавление купленных игр в библиотеку пользователя
- **User Service:** Аутентификация и получение данных пользователей

### Платежные провайдеры
- **Сбербанк Онлайн:** Интеграция через API эквайринга
- **ЮMoney:** Интеграция через API платежей
- **Т-Банк:** Интеграция через API эквайринга

### База данных
- PostgreSQL с TypeORM
- Автоматические миграции
- Индексы для оптимизации запросов
- Связи между заказами и платежами

### Кэширование
- Redis для кэширования данных игр
- Кэширование результатов запросов к внешним сервисам
- TTL для автоматической очистки кэша

## 📝 Разработка

### Команды разработчика
```bash
# Генерация миграции
npm run migration:generate --name=MigrationName

# Запуск миграций
npm run migration:run

# Откат миграции
npm run migration:revert

# Линтинг
npm run lint

# Форматирование кода
npm run format

# Сборка проекта
npm run build
```

### Стандарты кода
- ESLint для статического анализа
- Prettier для форматирования
- Husky для pre-commit hooks
- Conventional commits
- TypeScript strict mode

### Добавление нового платежного провайдера
1. Создайте класс провайдера в `src/modules/payment/providers/`
2. Реализуйте интерфейс `PaymentProviderInterface`
3. Добавьте провайдера в `PaymentProviderFactory`
4. Обновите enum `PaymentProvider`
5. Добавьте тесты для нового провайдера

## 🐛 Отладка

### Логи
```bash
# Просмотр логов Docker
docker-compose logs -f payment-service

# Локальные логи
tail -f logs/application.log
tail -f logs/payments.log
tail -f logs/errors.log
```

### Отладка платежей
```bash
# Проверка статуса платежа
curl -H "Authorization: Bearer <token>" \
     http://localhost:3005/payments/<payment-id>

# Принудительное завершение платежа (для тестирования)
curl -X POST -H "Authorization: Bearer <admin-token>" \
     http://localhost:3005/admin/payment-simulation/force-success/<payment-id>
```

### Отладка в IDE
Настройте отладчик для порта `9229` при запуске с `--debug`

## 🔒 Безопасность

### Аутентификация
- JWT токены для всех защищенных эндпоинтов
- Валидация токенов через User Service
- Rate limiting для предотвращения злоупотреблений

### Webhook безопасность
- Валидация подписей webhook'ов
- Проверка IP адресов провайдеров
- Защита от replay атак

### Данные
- Хеширование чувствительных данных
- Исключение паролей и токенов из логов
- Шифрование данных в базе (при необходимости)

## 📚 Дополнительные ресурсы

- [NestJS Documentation](https://docs.nestjs.com/)
- [TypeORM Documentation](https://typeorm.io/)
- [Swagger Documentation](http://localhost:3005/api/docs)
- [Сбербанк API Documentation](https://developer.sberbank.ru/)
- [ЮMoney API Documentation](https://yoomoney.ru/docs/)
- [Т-Банк API Documentation](https://www.tbank.ru/kassa/dev/)

## 🤝 Вклад в разработку

1. Создайте feature branch
2. Внесите изменения
3. Добавьте тесты
4. Запустите линтинг и тесты
5. Обновите документацию
6. Создайте Pull Request

## 📄 Лицензия

Этот проект использует лицензию UNLICENSED.

## 🆘 Поддержка

Для получения помощи:
1. Проверьте документацию
2. Посмотрите логи сервиса
3. Проверьте health checks
4. Создайте issue в репозитории
5. Обратитесь к команде разработки