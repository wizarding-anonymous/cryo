# User Service

Микросервис управления пользователями для игровой платформы. Обеспечивает аутентификацию, авторизацию и управление профилями пользователей.

## 📋 Описание

User Service - это основной микросервис, отвечающий за управление пользователями в игровой платформе. Он предоставляет функциональность регистрации, аутентификации, управления профилями и безопасности пользователей. Сервис построен на NestJS с использованием TypeScript и интегрирован с PostgreSQL для хранения данных и Redis для кэширования и управления сессиями.

## 🚀 Основной функционал

### Аутентификация и авторизация
- ✅ Регистрация новых пользователей с валидацией данных
- ✅ Аутентификация пользователей (логин/логаут)
- ✅ JWT токены для авторизации
- ✅ Хеширование паролей с использованием bcrypt
- ✅ Блэклист токенов при логауте
- ✅ Защита от брутфорс атак с помощью rate limiting

### Управление профилями
- ✅ Просмотр профиля пользователя
- ✅ Обновление данных профиля
- ✅ Удаление аккаунта пользователя
- ✅ Валидация входящих данных

### Безопасность
- ✅ JWT стратегия аутентификации
- ✅ Глобальные guards для защиты эндпоинтов
- ✅ Rate limiting для предотвращения злоупотреблений
- ✅ Валидация и санитизация входящих данных
- ✅ Исключение чувствительных данных из ответов

### Мониторинг и логирование
- ✅ Health checks для базы данных и Redis
- ✅ Prometheus метрики
- ✅ Структурированное логирование с Winston
- ✅ Глобальная обработка ошибок
- ✅ Интерцепторы для логирования запросов

### Интеграции
- ✅ Интеграция с Notification Service
- ✅ Интеграция с Security Service
- ✅ Кэширование с Redis
- ✅ Swagger документация API

## 🔄 User Flows

### 1. Регистрация пользователя
```
Пользователь → POST /api/auth/register → Валидация данных → 
Проверка уникальности email → Хеширование пароля → 
Сохранение в БД → Генерация JWT токена → Возврат токена и данных пользователя
```

### 2. Аутентификация пользователя
```
Пользователь → POST /api/auth/login → Валидация credentials → 
Проверка пароля → Генерация JWT токена → Возврат токена
```

### 3. Просмотр профиля
```
Пользователь → GET /api/users/profile (с JWT токеном) → 
Валидация токена → Получение данных из БД → Возврат профиля
```

### 4. Обновление профиля
```
Пользователь → PUT /api/users/profile (с JWT токеном и данными) → 
Валидация токена → Валидация данных → Обновление в БД → 
Возврат обновленного профиля
```

### 5. Логаут
```
Пользователь → POST /api/auth/logout (с JWT токеном) → 
Валидация токена → Добавление токена в блэклист (Redis) → 
Подтверждение логаута
```

### 6. Удаление аккаунта
```
Пользователь → DELETE /api/users/profile (с JWT токеном) → 
Валидация токена → Удаление из БД → Подтверждение удаления
```

## 🛠 API Эндпоинты

### Authentication (`/api/auth`)

| Метод | Эндпоинт | Описание | Аутентификация |
|-------|----------|----------|----------------|
| `POST` | `/auth/register` | Регистрация нового пользователя | ❌ |
| `POST` | `/auth/login` | Аутентификация пользователя | ❌ |
| `POST` | `/auth/logout` | Логаут пользователя | ✅ JWT |

#### POST /api/auth/register
**Описание:** Регистрация нового пользователя
**Body:**
```json
{
  "name": "John Doe",
  "email": "user@example.com",
  "password": "strongPassword123"
}
```
**Ответ:**
```json
{
  "user": {
    "id": "uuid",
    "name": "John Doe",
    "email": "user@example.com",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "access_token": "jwt_token_here"
}
```

#### POST /api/auth/login
**Описание:** Аутентификация пользователя
**Body:**
```json
{
  "email": "user@example.com",
  "password": "strongPassword123"
}
```
**Ответ:**
```json
{
  "access_token": "jwt_token_here",
  "user": {
    "id": "uuid",
    "name": "John Doe",
    "email": "user@example.com"
  }
}
```

#### POST /api/auth/logout
**Описание:** Логаут пользователя (добавление токена в блэклист)
**Headers:** `Authorization: Bearer <jwt_token>`
**Ответ:** `204 No Content`

### Users (`/api/users`)

| Метод | Эндпоинт | Описание | Аутентификация |
|-------|----------|----------|----------------|
| `GET` | `/users/profile` | Получение профиля пользователя | ✅ JWT |
| `PUT` | `/users/profile` | Обновление профиля пользователя | ✅ JWT |
| `DELETE` | `/users/profile` | Удаление аккаунта пользователя | ✅ JWT |

#### GET /api/users/profile
**Описание:** Получение профиля текущего пользователя
**Headers:** `Authorization: Bearer <jwt_token>`
**Ответ:**
```json
{
  "id": "uuid",
  "name": "John Doe",
  "email": "user@example.com",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

#### PUT /api/users/profile
**Описание:** Обновление профиля текущего пользователя
**Headers:** `Authorization: Bearer <jwt_token>`
**Body:**
```json
{
  "name": "John Doe Updated"
}
```

#### DELETE /api/users/profile
**Описание:** Удаление аккаунта текущего пользователя
**Headers:** `Authorization: Bearer <jwt_token>`
**Ответ:** `204 No Content`

### Profile (`/api/profile`)

| Метод | Эндпоинт | Описание | Аутентификация |
|-------|----------|----------|----------------|
| `GET` | `/profile` | Получение профиля пользователя | ✅ JWT |
| `PUT` | `/profile` | Обновление профиля пользователя | ✅ JWT |
| `DELETE` | `/profile` | Удаление аккаунта пользователя | ✅ JWT |

*Примечание: Эндпоинты `/profile` дублируют функциональность `/users/profile` для удобства использования*

### Health Check (`/api/v1/health`)

| Метод | Эндпоинт | Описание | Аутентификация |
|-------|----------|----------|----------------|
| `GET` | `/v1/health` | Базовая проверка здоровья сервиса | ❌ |
| `GET` | `/v1/health/detailed` | Детальная проверка здоровья сервиса | ❌ |

### Root

| Метод | Эндпоинт | Описание | Аутентификация |
|-------|----------|----------|----------------|
| `GET` | `/` | Приветственное сообщение | ❌ |

### Документация API

| Эндпоинт | Описание |
|----------|----------|
| `/api/api-docs` | Swagger UI документация |

## 🏗 Архитектура

### Технологический стек
- **Framework:** NestJS (Node.js)
- **Language:** TypeScript
- **Database:** PostgreSQL
- **Cache:** Redis
- **Authentication:** JWT (JSON Web Tokens)
- **Password Hashing:** bcrypt
- **Validation:** class-validator, class-transformer
- **Documentation:** Swagger/OpenAPI
- **Logging:** Winston
- **Metrics:** Prometheus
- **Testing:** Jest

### Структура проекта
```
src/
├── auth/                 # Модуль аутентификации
│   ├── dto/             # Data Transfer Objects
│   ├── guards/          # JWT Guards
│   ├── strategies/      # Passport стратегии
│   └── auth.service.ts  # Бизнес-логика аутентификации
├── user/                # Модуль пользователей
│   ├── dto/            # DTO для пользователей
│   ├── entities/       # TypeORM сущности
│   └── user.service.ts # Бизнес-логика пользователей
├── profile/            # Модуль профилей
├── health/             # Health checks
├── config/             # Конфигурация приложения
├── common/             # Общие компоненты
│   ├── filters/        # Exception filters
│   ├── interceptors/   # Interceptors
│   ├── logging/        # Логирование
│   ├── prometheus/     # Метрики
│   └── redis/          # Redis интеграция
├── database/           # Миграции БД
└── integrations/       # Внешние интеграции
```

## 🚀 Установка и запуск

### Предварительные требования
- Node.js 18+
- PostgreSQL 13+
- Redis 6+
- Docker (опционально)

### Локальная разработка

1. **Клонирование репозитория:**
```bash
git clone <repository-url>
cd backend/user-service
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
docker-compose up -d postgres redis

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

Сервис будет доступен по адресу: `http://localhost:3001/api`

### Docker

1. **Сборка образа:**
```bash
npm run docker:build
```

2. **Запуск с Docker Compose:**
```bash
npm run docker:up
```

3. **Просмотр логов:**
```bash
npm run docker:logs
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

### Нагрузочное тестирование
```bash
cd load-test
# Следуйте инструкциям в load-test/README.md
```

## 📊 Мониторинг

### Health Checks
- **Базовый:** `GET /api/v1/health`
- **Детальный:** `GET /api/v1/health/detailed`

### Метрики Prometheus
Доступны по адресу: `http://localhost:9090/metrics` (если включены)

### Логирование
- Структурированные логи в JSON формате (продакшн)
- Простой формат для разработки
- Настраиваемый уровень логирования

## 🔧 Конфигурация

### Основные переменные окружения

| Переменная | Описание | По умолчанию |
|------------|----------|--------------|
| `NODE_ENV` | Окружение | `development` |
| `PORT` | Порт сервиса | `3001` |
| `POSTGRES_HOST` | Хост PostgreSQL | `localhost` |
| `POSTGRES_PORT` | Порт PostgreSQL | `5432` |
| `REDIS_HOST` | Хост Redis | `localhost` |
| `REDIS_PORT` | Порт Redis | `6379` |
| `JWT_SECRET` | Секрет для JWT | - |
| `JWT_EXPIRES_IN` | Время жизни JWT | `1h` |
| `THROTTLE_LIMIT` | Лимит запросов | `60` |
| `LOG_LEVEL` | Уровень логирования | `info` |

### Rate Limiting
- 60 запросов в минуту по умолчанию
- Настраивается через `THROTTLE_LIMIT` и `THROTTLE_TTL`

### CORS
- Настраивается через переменные `CORS_*`
- По умолчанию разрешены все источники в разработке

## 🔗 Интеграции

### Внешние сервисы
- **Notification Service:** Отправка уведомлений
- **Security Service:** Дополнительные проверки безопасности

### База данных
- PostgreSQL с TypeORM
- Автоматические миграции
- Индексы для оптимизации запросов

### Кэширование
- Redis для блэклиста JWT токенов
- Кэширование сессий и временных данных

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
```

### Стандарты кода
- ESLint для статического анализа
- Prettier для форматирования
- Husky для pre-commit hooks
- Conventional commits

## 🐛 Отладка

### Логи
```bash
# Просмотр логов Docker
npm run docker:logs

# Локальные логи
tail -f logs/app.log
```

### Отладка в IDE
Настройте отладчик для порта `9229` при запуске с `--debug`

## 📚 Дополнительные ресурсы

- [NestJS Documentation](https://docs.nestjs.com/)
- [TypeORM Documentation](https://typeorm.io/)
- [JWT.io](https://jwt.io/)
- [Swagger Documentation](http://localhost:3001/api/api-docs)

## 🤝 Вклад в разработку

1. Создайте feature branch
2. Внесите изменения
3. Добавьте тесты
4. Запустите линтинг и тесты
5. Создайте Pull Request

## 📄 Лицензия

Этот проект использует лицензию UNLICENSED.