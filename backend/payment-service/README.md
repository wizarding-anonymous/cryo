# Payment Service

Payment Service для российской игровой платформы MVP. Обеспечивает обработку платежей с имитацией российских платежных систем для мануального тестирования.

## Особенности

- 🏦 **Имитация российских платежных систем**: Сбербанк, ЮMoney, Т-Банк
- 💳 **Управление заказами**: Создание и отслеживание заказов на игры
- 🔒 **Безопасность**: JWT аутентификация, валидация данных
- 📊 **Мониторинг**: Health checks, метрики, логирование
- 🐳 **Контейнеризация**: Docker и docker-compose для разработки
- 🧪 **Тестирование**: Unit и E2E тесты с Jest

## Технологический стек

- **Framework**: NestJS + TypeScript
- **База данных**: PostgreSQL + TypeORM
- **Кеш**: Redis
- **Документация**: Swagger/OpenAPI
- **Тестирование**: Jest + Supertest
- **Контейнеризация**: Docker

## Быстрый старт

### Предварительные требования

- Node.js 18+
- Docker и Docker Compose
- PostgreSQL 15+ (или через Docker)
- Redis 7+ (или через Docker)

### Установка

1. **Клонирование и установка зависимостей:**
```bash
cd backend/payment-service
npm install
```

2. **Настройка переменных окружения:**
```bash
cp .env.example .env
# Отредактируйте .env файл с вашими настройками
```

3. **Запуск с Docker Compose (рекомендуется):**
```bash
docker-compose up -d
```

4. **Или запуск в режиме разработки:**
```bash
npm run start:dev
```

### Доступные эндпоинты

- **Приложение**: http://localhost:3003
- **Swagger документация**: http://localhost:3003/api/docs
- **Health check**: http://localhost:3003/health
- **Redis Commander**: http://localhost:8082 (при запуске через docker-compose)

## Разработка

### Команды

```bash
# Разработка
npm run start:dev          # Запуск в режиме разработки
npm run start:debug        # Запуск с отладкой

# Сборка
npm run build              # Сборка проекта
npm run start:prod         # Запуск production сборки

# Тестирование
npm run test               # Unit тесты
npm run test:watch         # Unit тесты в watch режиме
npm run test:cov           # Тесты с покрытием
npm run test:e2e           # E2E тесты

# Качество кода
npm run lint               # ESLint проверка
npm run format             # Prettier форматирование

# База данных
npm run migration:generate # Генерация миграции
npm run migration:run      # Применение миграций
npm run migration:revert   # Откат миграции
```

### Структура проекта

```
src/
├── common/                 # Общие компоненты
│   ├── filters/           # Глобальные фильтры
│   └── interceptors/      # Интерцепторы
├── config/                # Конфигурация
│   ├── database.config.ts # Настройки БД
│   ├── cache.config.ts    # Настройки Redis
│   └── env.validation.ts  # Валидация переменных
├── modules/               # Бизнес модули
│   ├── health/           # Health checks
│   ├── order/            # Управление заказами
│   └── payment/          # Обработка платежей
├── app.module.ts         # Главный модуль
└── main.ts              # Точка входа
```

## API Документация

После запуска сервиса, Swagger документация доступна по адресу:
http://localhost:3003/api/docs

### Основные эндпоинты

- `GET /` - Информация о сервисе
- `GET /health` - Проверка здоровья сервиса
- `GET /orders` - Список заказов
- `GET /payments` - Список платежей

## Имитация платежных систем

Для MVP реализована имитация российских платежных систем:

- **Сбербанк**: `POST /mock/sberbank`
- **ЮMoney**: `POST /mock/yandex`
- **Т-Банк**: `POST /mock/tbank`

Все имитации возвращают предсказуемые ответы для тестирования различных сценариев.

## Мониторинг и логирование

### Health Checks

- `GET /health` - Общая проверка здоровья
- `GET /health/ready` - Готовность к обработке запросов
- `GET /health/live` - Проверка жизнеспособности

### Логирование

Все запросы и ошибки логируются с помощью Winston. Логи включают:
- HTTP запросы и ответы
- Ошибки и исключения
- Операции с базой данных
- Интеграции с внешними сервисами

## Интеграции

### Внешние сервисы

- **User Service** (http://localhost:3001) - Проверка пользователей
- **Library Service** (http://localhost:3004) - Добавление игр в библиотеку

### События

В MVP используются REST API вызовы. В будущем планируется переход на event-driven архитектуру.

## Безопасность

- JWT токены для аутентификации
- Валидация всех входящих данных
- Rate limiting для защиты от DDoS
- Санитизация логов (скрытие чувствительных данных)
- CORS настройки

## Производительность

- Redis кеширование для часто запрашиваемых данных
- Индексы базы данных для оптимизации запросов
- Connection pooling для PostgreSQL
- Graceful shutdown

## Развертывание

### Docker

```bash
# Сборка образа
docker build -t payment-service .

# Запуск контейнера
docker run -p 3003:3003 payment-service
```

### Kubernetes

Kubernetes манифесты будут добавлены в следующих задачах.

## Тестирование

### Unit тесты

```bash
npm run test
```

### E2E тесты

```bash
npm run test:e2e
```

### Покрытие кода

```bash
npm run test:cov
```

Цель: 100% покрытие критического кода.

## Вклад в разработку

1. Создайте feature branch
2. Внесите изменения
3. Добавьте тесты
4. Убедитесь что все тесты проходят
5. Создайте Pull Request

## Лицензия

Проприетарное ПО. Все права защищены.

---

**Статус**: MVP готов к разработке ✅  
**Версия**: 0.0.1  
**Последнее обновление**: $(date)