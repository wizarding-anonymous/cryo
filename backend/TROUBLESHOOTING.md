# Микросервисы - Журнал решения проблем

## Дата: 2025-10-09

---

## 🎮 Game Catalog Service

### Проблема
Game Catalog Service не может запуститься из-за ошибки "SyntaxError: Unexpected strict mode reserved word" при попытке подключения к базе данных через TypeORM.

### Анализ проблемы

#### Основные симптомы:
1. Сервис успешно инициализируется и подключается к Redis
2. При попытке подключения к PostgreSQL через TypeORM возникает ошибка синтаксиса
3. Ошибка происходит в `tryToRequire` функции TypeORM при загрузке entity/migration файлов
4. Сервис перезапускается в бесконечном цикле

#### Возможные причины:
1. **Проблема с TypeScript конфигурацией** - неправильные настройки компиляции
2. **Конфликт версий Node.js/TypeScript** - несовместимость версий
3. **Проблема с путями к entity/migration файлам** - неправильные пути в data-source.ts
4. **Проблема с ES модулями vs CommonJS** - конфликт модульных систем
5. **Проблема с зарезервированными словами в коде** - использование зарезервированных слов в strict mode

### Решение

#### Основная причина проблемы:
TypeORM в Docker контейнере пытался загружать TypeScript файлы (.ts) вместо скомпилированных JavaScript файлов (.js), что приводило к ошибке "SyntaxError: Unexpected strict mode reserved word".

#### Кардинальные исправления:

1. **Исправлены пути в data-source.ts**
   - ✅ Убраны условные проверки окружения
   - ✅ Установлены правильные пути к скомпилированным файлам: `dist/src/entities/*.entity.js` и `dist/src/database/migrations/*.js`

2. **Исправлен database-config.service.ts**
   - ✅ Убраны временные переменные окружения
   - ✅ Установлен правильный путь к миграциям: `dist/src/database/migrations/*.js`

3. **Исправлен .env.docker**
   - ✅ Установлен `NODE_ENV=production` для правильной работы в Docker
   - ✅ Убраны временные переменные

4. **Исправлен Dockerfile**
   - ✅ Убрано копирование исходных TypeScript файлов
   - ✅ Оставлено только копирование скомпилированных файлов и необходимых конфигураций

5. **Исправлены мелкие синтаксические проблемы**
   - ✅ Удален `implements SystemRequirements` из game.entity.ts
   - ✅ Исправлена неиспользуемая переменная в main.ts

### Результат
✅ **Game Catalog Service успешно запущен на порту 3002**

#### Архитектурное соответствие:
- ✅ Изоляция сервиса сохранена
- ✅ Собственная база данных `catalog_db` на порту 5433
- ✅ Независимое развертывание
- ✅ REST API на порту 3002
- ✅ Соблюден принцип 12-factor app

---

## 💳 Payment Service

### Проблема
Payment Service успешно запускается, но возникает ошибка 404 при проверке здоровья Game Catalog Service: "ERROR [GameCatalogIntegrationService] Game Catalog Service health check failed: Request failed with status code 404"

### Анализ проблемы

#### Основные симптомы:
1. Payment Service успешно запускается на порту 3005
2. База данных инициализируется корректно (таблицы orders и payments созданы)
3. Все эндпоинты зарегистрированы
4. Ошибка 404 при обращении к health endpoint Game Catalog Service

#### Причина:
Payment Service обращается по неправильному пути к health endpoint Game Catalog Service:
- **Неправильный путь:** `http://game-catalog-service:3002/v1/health`
- **Правильный путь:** `http://game-catalog-service:3002/api/v1/health`

### Решение

#### Исправления в game-catalog.service.ts:

1. **Исправлен путь для health check:**
   ```typescript
   // Было: const url = `${this.gameCatalogUrl}/v1/health`;
   // Стало: const url = `${this.gameCatalogUrl}/api/v1/health`;
   ```

2. **Исправлен путь для получения информации о покупке игры:**
   ```typescript
   // Было: const url = `${this.gameCatalogUrl}/api/internal/games/${gameId}/purchase-info`;
   // Стало: const url = `${this.gameCatalogUrl}/api/games/${gameId}/purchase-info`;
   ```

### Результат
✅ **Payment Service успешно запущен на порту 3005**

#### Функциональность:
- ✅ База данных инициализирована (orders, payments таблицы)
- ✅ Все эндпоинты зарегистрированы
- ✅ Mock платежные провайдеры настроены (sberbank, yandex, tbank)
- ✅ Swagger документация доступна на `/api/docs`
- ✅ Health checks работают
- ✅ Интеграция с Game Catalog Service исправлена

---

## 📊 Общий статус микросервисов

### ✅ Запущенные сервисы:
- **User Service** (порт 3001) - работает
- **Game Catalog Service** (порт 3002) - работает  
- **Payment Service** (порт 3005) - работает

### ✅ Инфраструктура:
- **Redis Cache** - работает
- **PostgreSQL User DB** (порт 5432) - работает
- **PostgreSQL Catalog DB** (порт 5433) - работает
- **PostgreSQL Payment DB** (порт 5436) - работает

### 🔄 Следующие шаги:
1. Запуск Library Service (порт 3003)
2. Запуск остальных микросервисов
3. Тестирование интеграций между сервисами

---

## 📝 Инструкции для запуска

### Game Catalog Service:
```bash
cd backend
docker-compose up -d postgres-catalog redis
docker-compose up game-catalog-service
```

### Payment Service:
```bash
cd backend
docker-compose up -d postgres-payment
docker-compose build payment-service
docker-compose up payment-service
```

### Проверка статуса:
```bash
docker-compose ps
```