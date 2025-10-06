# Game Catalog Service

Микросервис каталога игр для игровой платформы. Обеспечивает управление каталогом игр, поиск, фильтрацию и предоставление информации о играх для других сервисов.

## 📋 Описание

Game Catalog Service - это микросервис, отвечающий за управление каталогом игр в игровой платформе. Он предоставляет функциональность просмотра, поиска, фильтрации игр, а также управления каталогом. Сервис построен на NestJS с использованием TypeScript и интегрирован с PostgreSQL для хранения данных и Redis для кэширования. Включает полнотекстовый поиск с поддержкой русского языка.

## 🚀 Основной функционал

### Управление каталогом игр
- ✅ Просмотр списка игр с пагинацией
- ✅ Получение детальной информации об игре
- ✅ Создание новых игр в каталоге
- ✅ Обновление информации об играх
- ✅ Удаление игр из каталога
- ✅ Фильтрация по жанру и доступности

### Поиск и фильтрация
- ✅ Полнотекстовый поиск по названию и описанию
- ✅ Поддержка русского языка в поиске
- ✅ Фильтрация по цене (минимальная/максимальная)
- ✅ Сортировка по различным полям
- ✅ Пагинация результатов поиска

### Интеграция с другими сервисами
- ✅ Предоставление информации для Payment Service
- ✅ API для получения данных о покупке игры
- ✅ Кэширование для оптимизации производительности

### Производительность и надежность
- ✅ Redis кэширование с настраиваемым TTL
- ✅ Таймауты для операций
- ✅ Перехватчики производительности
- ✅ Трансформация ответов
- ✅ Валидация входящих данных

### Мониторинг и логирование
- ✅ Health checks для базы данных и Redis
- ✅ Prometheus метрики
- ✅ Структурированное логирование
- ✅ Глобальная обработка ошибок
- ✅ Swagger документация API

## 🔄 Game Flows

### 1. Просмотр каталога игр
```
Пользователь → GET /api/games → Валидация параметров → 
Получение из кэша/БД → Применение фильтров → 
Пагинация → Возврат списка игр
```

### 2. Поиск игр
```
Пользователь → GET /api/games/search?q=запрос → Валидация параметров → 
Полнотекстовый поиск в PostgreSQL → Применение фильтров → 
Пагинация → Возврат результатов поиска
```

### 3. Получение информации об игре
```
Пользователь → GET /api/games/:id → Валидация UUID → 
Проверка кэша → Получение из БД → Возврат детальной информации
```

### 4. Получение информации для покупки
```
Payment Service → GET /api/games/:id/purchase-info → Валидация UUID → 
Проверка доступности → Получение цены и валюты → 
Возврат информации для платежа
```

### 5. Создание игры
```
Администратор → POST /api/games → Валидация данных → 
Сохранение в БД → Очистка кэша → Возврат созданной игры
```

### 6. Обновление игры
```
Администратор → PATCH /api/games/:id → Валидация данных → 
Обновление в БД → Очистка кэша → Возврат обновленной игры
```

## 🛠 API Эндпоинты

### Games (`/api/games`)

| Метод | Эндпоинт | Описание | Кэширование |
|-------|----------|----------|-------------|
| `GET` | `/games` | Получение списка игр с пагинацией | ✅ 10 мин |
| `GET` | `/games/search` | Поиск игр по различным критериям | ✅ 5 мин |
| `GET` | `/games/:id` | Получение детальной информации об игре | ✅ 30 мин |
| `GET` | `/games/:id/purchase-info` | Получение информации для покупки | ✅ 15 мин |
| `POST` | `/games` | Создание новой игры | ❌ |
| `PATCH` | `/games/:id` | Обновление игры | ❌ |
| `DELETE` | `/games/:id` | Удаление игры | ❌ |

#### GET /api/games
**Описание:** Получение пагинированного списка игр с фильтрацией и сортировкой
**Query параметры:**
- `page` (optional): Номер страницы (по умолчанию: 1)
- `limit` (optional): Количество элементов на странице (по умолчанию: 10, максимум: 100)
- `sortBy` (optional): Поле для сортировки (title, price, releaseDate, createdAt)
- `sortOrder` (optional): Порядок сортировки (ASC, DESC)
- `genre` (optional): Фильтр по жанру
- `available` (optional): Фильтр по доступности

**Ответ:**
```json
{
  "games": [
    {
      "id": "uuid",
      "title": "Cyberpunk 2077",
      "description": "Futuristic RPG...",
      "shortDescription": "Futuristic RPG in Night City",
      "price": 2999.99,
      "currency": "RUB",
      "genre": "Action RPG",
      "developer": "CD Projekt RED",
      "publisher": "CD Projekt",
      "releaseDate": "2020-12-10",
      "images": ["url1", "url2"],
      "systemRequirements": {
        "minimum": "OS: Windows 10...",
        "recommended": "OS: Windows 11..."
      },
      "available": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 10
}
```

#### GET /api/games/search
**Описание:** Поиск игр с полнотекстовым поиском и фильтрацией
**Query параметры:**
- `q` (optional): Поисковый запрос (1-255 символов)
- `searchType` (optional): Тип поиска (title, description, all)
- `page` (optional): Номер страницы
- `limit` (optional): Количество элементов на странице
- `minPrice` (optional): Минимальная цена
- `maxPrice` (optional): Максимальная цена

#### GET /api/games/:id
**Описание:** Получение детальной информации об игре по UUID
**Параметры:**
- `id`: UUID игры

#### GET /api/games/:id/purchase-info
**Описание:** Получение информации для покупки (используется Payment Service)
**Ответ:**
```json
{
  "id": "uuid",
  "title": "Game Title",
  "price": 1999.99,
  "currency": "RUB",
  "available": true
}
```

#### POST /api/games
**Описание:** Создание новой игры в каталоге
**Body:**
```json
{
  "title": "The Witcher 3: Wild Hunt",
  "description": "An epic RPG adventure...",
  "shortDescription": "Epic RPG adventure",
  "price": 1999.99,
  "currency": "RUB",
  "developer": "CD Projekt RED",
  "publisher": "CD Projekt",
  "genre": "RPG",
  "releaseDate": "2015-05-19",
  "available": true,
  "images": ["url1", "url2"],
  "systemRequirements": {
    "minimum": "OS: Windows 7...",
    "recommended": "OS: Windows 10..."
  }
}
```

#### PATCH /api/games/:id
**Описание:** Обновление существующей игры
**Параметры:**
- `id`: UUID игры
**Body:** Частичные данные игры для обновления

#### DELETE /api/games/:id
**Описание:** Удаление игры из каталога
**Параметры:**
- `id`: UUID игры
**Ответ:** `204 No Content`

### Search (`/api/search`)

| Метод | Эндпоинт | Описание | Кэширование |
|-------|----------|----------|-------------|
| `GET` | `/search/search` | Расширенный поиск игр | ✅ 5 мин |

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
- **Database:** PostgreSQL с полнотекстовым поиском
- **Cache:** Redis
- **Validation:** class-validator, class-transformer
- **Documentation:** Swagger/OpenAPI
- **Logging:** Winston
- **Metrics:** Prometheus
- **Testing:** Jest

### Структура проекта
```
src/
├── game/                 # Модуль игр
│   ├── game.controller.ts # Контроллер игр
│   ├── game.service.ts   # Бизнес-логика игр
│   └── game.module.ts    # Модуль игр
├── search/              # Модуль поиска
│   ├── search.controller.ts # Контроллер поиска
│   ├── search.service.ts    # Сервис поиска
│   └── search.module.ts     # Модуль поиска
├── entities/            # TypeORM сущности
│   └── game.entity.ts   # Сущность игры
├── dto/                 # Data Transfer Objects
│   ├── create-game.dto.ts
│   ├── update-game.dto.ts
│   ├── game-response.dto.ts
│   ├── search-games.dto.ts
│   └── purchase-info.dto.ts
├── interfaces/          # Интерфейсы
│   ├── game.interface.ts
│   └── game-service.interface.ts
├── database/            # Конфигурация БД
│   ├── migrations/      # Миграции БД
│   ├── database.module.ts
│   └── redis-config.service.ts
├── health/              # Health checks
│   ├── health.controller.ts
│   ├── metrics.service.ts
│   └── logging.service.ts
├── common/              # Общие компоненты
│   ├── controllers/     # Базовые контроллеры
│   ├── decorators/      # Декораторы (кэширование)
│   ├── filters/         # Exception filters
│   ├── interceptors/    # Interceptors
│   └── services/        # Общие сервисы
└── types/               # Типы TypeScript
```

## 🚀 Установка и запуск

### Предварительные требования
- Node.js 20+
- PostgreSQL 13+
- Redis 6+
- Docker (опционально)

### Локальная разработка

1. **Клонирование репозитория:**
```bash
git clone <repository-url>
cd backend/game-catalog-service
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

Сервис будет доступен по адресу: `http://localhost:3002/api`

### Docker

1. **Сборка образа:**
```bash
docker build -t game-catalog-service .
```

2. **Запуск с Docker Compose:**
```bash
docker-compose up -d
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

# Интеграционные тесты
npm run test:integration

# Тестирование подключения к БД
npm run test:db

# Тестирование Redis
npm run test:redis
```

## 📊 Мониторинг

### Health Checks
- **Базовый:** `GET /api/v1/health`
- **Детальный:** `GET /api/v1/health/detailed`

### Метрики Prometheus
Доступны по адресу: `http://localhost:9090/metrics` (если включены)

### Кэширование
- Списки игр: 10 минут TTL
- Детальная информация об игре: 30 минут TTL
- Результаты поиска: 5 минут TTL
- Информация для покупки: 15 минут TTL

### Логирование
- Структурированные логи в JSON формате (продакшн)
- Простой формат для разработки
- Настраиваемый уровень логирования

## 🔧 Конфигурация

### Основные переменные окружения

| Переменная | Описание | По умолчанию |
|------------|----------|--------------|
| `NODE_ENV` | Окружение | `development` |
| `PORT` | Порт сервиса | `3002` |
| `POSTGRES_HOST` | Хост PostgreSQL | `localhost` |
| `POSTGRES_PORT` | Порт PostgreSQL | `5432` |
| `POSTGRES_DB` | База данных | `game_catalog` |
| `REDIS_HOST` | Хост Redis | `localhost` |
| `REDIS_PORT` | Порт Redis | `6379` |
| `CACHE_TTL` | TTL кэша по умолчанию | `600` |
| `LOG_LEVEL` | Уровень логирования | `info` |

### Настройки поиска
- Поддержка русского языка в полнотекстовом поиске
- Индексы для оптимизации поиска по названию и жанру
- Настраиваемые лимиты пагинации

### Таймауты
- Список игр: 15 секунд
- Поиск: 12 секунд
- Детальная информация: 10 секунд
- Информация для покупки: 8 секунд

## 🔗 Интеграции

### Внешние сервисы
- **Payment Service:** Предоставление информации для покупки игр
- **Library Service:** Информация о доступных играх
- **User Service:** Интеграция через API Gateway

### База данных
- PostgreSQL с TypeORM
- Полнотекстовый поиск с поддержкой русского языка
- Индексы для оптимизации запросов
- JSONB для системных требований

### Кэширование
- Redis для кэширования результатов
- Настраиваемые TTL для разных типов данных
- Автоматическая очистка кэша при обновлениях

## 📝 Разработка

### Команды разработчика
```bash
# Генерация миграции
npm run migration:generate --name=MigrationName

# Запуск миграций
npm run migration:run

# Откат миграции
npm run migration:revert

# Просмотр статуса миграций
npm run migration:show

# Создание новой миграции
npm run migration:create --name=MigrationName

# Настройка БД
npm run db:setup

# Линтинг
npm run lint

# Форматирование кода
npm run format
```

### Стандарты кода
- ESLint для статического анализа
- Prettier для форматирования
- TypeScript для типизации
- Валидация DTO с class-validator

## 🐛 Отладка

### Логи
```bash
# Просмотр логов Docker
docker-compose logs game-catalog-service

# Локальные логи
tail -f logs/app.log
```

### Отладка в IDE
Настройте отладчик для порта `9229` при запуске с `--debug`

## 📚 Дополнительные ресурсы

- [NestJS Documentation](https://docs.nestjs.com/)
- [TypeORM Documentation](https://typeorm.io/)
- [PostgreSQL Full-Text Search](https://www.postgresql.org/docs/current/textsearch.html)
- [Redis Documentation](https://redis.io/documentation)
- [Swagger Documentation](http://localhost:3002/api/api-docs)

## 🤝 Вклад в разработку

1. Создайте feature branch
2. Внесите изменения
3. Добавьте тесты
4. Запустите линтинг и тесты
5. Создайте Pull Request

## 📄 Лицензия

Этот проект использует лицензию UNLICENSED.