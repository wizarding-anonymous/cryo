# User Service

User Service для игровой платформы Cryo - обрабатывает аутентификацию пользователей, управление профилями и связанные с пользователями операции.

## Описание

Микросервис User Service является центральным компонентом системы аутентификации и управления пользователями в игровой платформе Cryo. Он предоставляет полный набор функций для регистрации, аутентификации, управления профилями пользователей и интеграции с другими микросервисами платформы.

## Реализованный функционал

### Основные возможности
- **Регистрация пользователей** - создание новых аккаунтов с валидацией данных
- **Аутентификация** - вход в систему с JWT токенами
- **Управление профилем** - просмотр и обновление профиля пользователя
- **Безопасность** - хеширование паролей, защита от брутфорса, логирование событий безопасности
- **Кеширование** - Redis для сессий и повышения производительности
- **Мониторинг** - Prometheus метрики и health checks
- **Логирование** - структурированное логирование с Winston

### Интеграции с микросервисами
- **Notification Service** - отправка уведомлений о регистрации и важных событиях
- **Security Service** - логирование событий безопасности (вход, регистрация, изменения)
- **API Gateway** - маршрутизация запросов через единую точку входа

## API Endpoints

### Authentication (`/api/auth`)
- `POST /api/auth/register` - Регистрация нового пользователя
- `POST /api/auth/login` - Вход в систему
- `POST /api/auth/logout` - Выход из системы (требует JWT)

### User Management (`/api/users`)
- `GET /api/users/profile` - Получение профиля текущего пользователя
- `PUT /api/users/profile` - Обновление профиля пользователя
- `DELETE /api/users/profile` - Удаление аккаунта пользователя

### Profile Management (`/api/profile`)
- `GET /api/profile` - Получение профиля (альтернативный endpoint)
- `PUT /api/profile` - Обновление профиля
- `DELETE /api/profile` - Удаление профиля

### Health & Monitoring (`/api/v1/health`)
- `GET /api/v1/health` - Базовая проверка здоровья сервиса
- `GET /api/v1/health/detailed` - Детальная информация о состоянии сервиса

### API Documentation
- `GET /api-docs` - Swagger UI документация

## User Flows

### Регистрация пользователя
1. Пользователь отправляет POST запрос на `/api/auth/register` с данными (name, email, password)
2. Сервис валидирует данные и проверяет уникальность email
3. Пароль хешируется с помощью bcrypt
4. Пользователь сохраняется в базе данных PostgreSQL
5. Отправляется уведомление в Notification Service
6. Логируется событие в Security Service
7. Возвращается JWT токен и данные пользователя

### Аутентификация
1. Пользователь отправляет POST запрос на `/api/auth/login` с email и паролем
2. Сервис проверяет существование пользователя и валидность пароля
3. При успешной аутентификации генерируется JWT токен
4. Логируется событие входа в Security Service
5. Возвращается JWT токен

### Управление профилем
1. Пользователь отправляет запрос с JWT токеном в заголовке Authorization
2. JWT токен валидируется и извлекается userId
3. Выполняется запрошенная операция (получение/обновление/удаление)
4. При изменениях логируется событие в Security Service

## Бизнес-логика

### Аутентификация и авторизация
- **JWT токены** - используются для аутентификации с настраиваемым временем жизни
- **Хеширование паролей** - bcrypt с солью для безопасного хранения
- **Blacklist токенов** - Redis для хранения отозванных токенов при logout
- **Rate limiting** - защита от брутфорса с помощью Throttler

### Валидация данных
- **Email** - проверка формата и уникальности
- **Пароль** - минимум 8 символов
- **Имя** - максимум 100 символов, обязательное поле

### Безопасность
- **Глобальные фильтры** - обработка исключений и стандартизация ответов
- **Валидация входных данных** - автоматическая валидация DTO с class-validator
- **Логирование событий** - все критические операции логируются
- **Health checks** - мониторинг состояния базы данных, Redis и памяти

## Настройка проекта

```bash
$ npm install
```

## Конфигурация окружения

### Локальная разработка
Скопируйте `.env.example` в `.env` и настройте локальное окружение:
```bash
cp .env.example .env
```

### Docker разработка
- **Local Docker Compose**: Использует `.env.local` (уже настроен)
- **Full Cryo Project**: Использует `.env.docker` (уже настроен)

## Запуск приложения

### Локальная разработка
```bash
# разработка
$ npm run start

# режим отслеживания изменений
$ npm run start:dev

# продакшн режим
$ npm run start:prod
```

### Docker разработка

#### Вариант 1: Локальная разработка (изолированная)
Для изолированной разработки user-service с выделенной базой данных и кешем:

```bash
# Запуск user-service с выделенными PostgreSQL и Redis
$ npm run docker:local:up

# Просмотр логов
$ npm run docker:local:logs

# Остановка сервисов
$ npm run docker:local:down

# Пересборка
$ npm run docker:local:build
```

#### Вариант 2: Полный проект Cryo
Для разработки со всеми микросервисами:

```bash
# Из директории backend - запуск всех микросервисов
$ cd ../
$ docker-compose up -d

# Запуск только user-service и его зависимостей
$ docker-compose up -d user-service

# Просмотр логов user-service
$ docker-compose logs -f user-service

# Остановка всех сервисов
$ docker-compose down
```

### Конфигурация портов

#### Local Docker Compose
- **Приложение**: 3001
- **PostgreSQL**: 5433 (внешний) → 5432 (внутренний)
- **Redis**: 6380 (внешний) → 6379 (внутренний)

#### Full Cryo Project
- **Приложение**: 3001
- **PostgreSQL**: 5432 (внешний) - общий с другими сервисами
- **Redis**: 6379 (внешний) - общий с другими сервисами

### Имена контейнеров

#### Local Docker Compose
- `user-service-local` - Основное приложение
- `user-service-postgres-local` - Выделенный PostgreSQL
- `user-service-redis-local` - Выделенный Redis

#### Full Cryo Project
- `user-service` - Основное приложение
- `postgres-user-db` - База данных PostgreSQL (общее соглашение об именовании)
- `redis-cache` - Redis кеш (общий с другими сервисами)

## Команды для тестирования

### Юнит тесты
```bash
# запуск всех юнит тестов
$ npm run test

# запуск тестов в режиме отслеживания
$ npm run test:watch

# запуск тестов с покрытием кода
$ npm run test:cov

# отладка тестов
$ npm run test:debug
```

### E2E тесты
```bash
# запуск всех e2e тестов
$ npm run test:e2e
```

### Доступные тестовые файлы
- `test/app.e2e-spec.ts` - Основные тесты приложения
- `test/auth.e2e-spec.ts` - Тесты аутентификации
- `test/user.e2e-spec.ts` - Тесты пользовательских операций
- `test/profile.e2e-spec.ts` - Тесты профиля
- `test/health.e2e-spec.ts` - Тесты health checks
- `test/swagger.e2e-spec.ts` - Тесты Swagger документации

## Миграции базы данных

```bash
# генерация новой миграции
$ npm run migration:generate --name=MigrationName

# запуск миграций
$ npm run migration:run

# откат последней миграции
$ npm run migration:revert

# работа с TypeORM CLI
$ npm run typeorm -- --help
```

## Deploy инструкции

### Kubernetes Deployment

#### Staging окружение
```bash
# Деплой в staging (автоматически при push в develop)
$ kubectl apply -f k8s/ -n microservices

# Проверка статуса деплоя
$ kubectl get pods -n microservices -l app=user-service

# Просмотр логов
$ kubectl logs -f deployment/user-service-deployment -n microservices
```

#### Production окружение
```bash
# Деплой в production (автоматически при push в main)
$ kubectl apply -f ../k8s/user-service-deployment.yaml

# Масштабирование
$ kubectl scale deployment user-service-deployment --replicas=5 -n microservices

# Обновление образа
$ kubectl set image deployment/user-service-deployment user-service=ghcr.io/your-org/cryo/user-service:v1.2.0 -n microservices
```

### Docker Deployment

#### Сборка образа
```bash
# Локальная сборка
$ docker build -t user-service:latest .

# Сборка для production
$ docker build -t ghcr.io/your-org/cryo/user-service:v1.0.0 .

# Push в registry
$ docker push ghcr.io/your-org/cryo/user-service:v1.0.0
```

#### Запуск в production
```bash
# Запуск с production конфигурацией
$ docker-compose -f ../docker-compose.prod.yml up -d user-service

# Проверка статуса
$ docker-compose -f ../docker-compose.prod.yml ps user-service

# Просмотр логов
$ docker-compose -f ../docker-compose.prod.yml logs -f user-service
```

### CI/CD Pipeline

Автоматический деплой настроен через GitHub Actions:

#### Staging деплой
- Триггер: push в ветку `develop`
- Условие: изменения в файлах user-service
- Образ: `develop-{commit-sha}`

#### Production деплой  
- Триггер: push в ветку `main`
- Деплой всех сервисов для консистентности
- Образ: `main-{commit-sha}`

### Мониторинг деплоя

```bash
# Проверка health check
$ curl http://localhost:3001/api/v1/health

# Проверка метрик Prometheus
$ curl http://localhost:9090/metrics

# Проверка Swagger документации
$ curl http://localhost:3001/api-docs
```

## Интеграция с другими микросервисами

### Notification Service
```typescript
// Отправка уведомления о регистрации
await notificationClient.sendWelcomeNotification(userId, email);
```

**Эндпоинты интеграции:**
- Отправка welcome уведомлений при регистрации
- Уведомления о важных изменениях профиля

### Security Service  
```typescript
// Логирование события безопасности
await securityClient.logSecurityEvent({
  userId,
  type: 'LOGIN_SUCCESS',
  ipAddress: req.ip,
  timestamp: new Date()
});
```

**События безопасности:**
- `LOGIN_SUCCESS` - успешный вход
- `LOGIN_FAILURE` - неудачная попытка входа  
- `USER_REGISTRATION` - регистрация пользователя
- `PASSWORD_CHANGE` - изменение пароля

### API Gateway
Все запросы проходят через API Gateway с префиксом `/api/users`:
- Маршрутизация запросов
- Rate limiting на уровне gateway
- Централизованная аутентификация

## Список инфраструктурных файлов

### Docker файлы
- `Dockerfile` - Multi-stage сборка для production
- `docker-compose.yml` - Локальная разработка с выделенными сервисами
- `.dockerignore` - Исключения для Docker сборки

### Kubernetes файлы
- `k8s/deployment.yaml` - Deployment конфигурация
- `k8s/service.yaml` - Service для внутренней связи
- `k8s/configmap.yaml` - Конфигурационные данные
- `k8s/secret.yaml` - Секретные данные
- `k8s/namespace.yaml` - Namespace определение
- `k8s/kustomization.yaml` - Kustomize конфигурация
- `../k8s/user-service-deployment.yaml` - Общий deployment файл
- `../k8s/user-service-monitoring.yaml` - Мониторинг конфигурация

### Конфигурационные файлы
- `.env.example` - Пример переменных окружения
- `.env.development` - Локальная разработка
- `.env.docker` - Docker окружение
- `.env.local` - Локальный Docker Compose
- `.env.production` - Production окружение
- `.env.test` - Тестовое окружение

### CI/CD файлы
- `../.github/workflows/microservices-ci-cd.yml` - GitHub Actions pipeline
- `data-source.ts` - TypeORM конфигурация для production
- `data-source.local.ts` - TypeORM для локальной разработки
- `data-source.test.ts` - TypeORM для тестов

### Конфигурация инструментов
- `nest-cli.json` - NestJS CLI конфигурация
- `tsconfig.json` - TypeScript основная конфигурация
- `tsconfig.build.json` - TypeScript для сборки
- `eslint.config.mjs` - ESLint конфигурация
- `.eslintrc.test.js` - ESLint для тестов
- `.prettierrc` - Prettier форматирование
- `jest` конфигурация в `package.json`
- `test/jest-e2e.json` - Jest для E2E тестов

### Документация
- `README.md` - Основная документация (этот файл)
- `CRYO_INTEGRATION.md` - Документация интеграции с Cryo
- `DOCKER_SETUP_GUIDE.md` - Руководство по Docker
- `DOCKER_NAMING_CHANGES.md` - Изменения в именовании Docker

## Мониторинг и логирование

### Prometheus метрики
- HTTP запросы и ответы
- Время выполнения запросов
- Использование памяти и CPU
- Состояние подключений к базе данных

### Health Checks
- `/api/v1/health` - Базовая проверка
- `/api/v1/health/detailed` - Детальная информация
- Проверка PostgreSQL подключения
- Проверка Redis подключения
- Проверка использования памяти

### Логирование
- Структурированные логи в JSON формате (production)
- Простой формат для разработки
- Различные уровни логирования (debug, info, warn, error)
- Централизованное логирование через ELK stack

## Технологический стек

### Основные технологии
- **NestJS** - Node.js фреймворк
- **TypeScript** - Типизированный JavaScript
- **PostgreSQL** - Реляционная база данных
- **Redis** - Кеширование и сессии
- **JWT** - Аутентификация
- **bcrypt** - Хеширование паролей

### Библиотеки и инструменты
- **TypeORM** - ORM для работы с базой данных
- **class-validator** - Валидация DTO
- **Swagger** - API документация
- **Winston** - Логирование
- **Prometheus** - Метрики
- **Jest** - Тестирование
- **Docker** - Контейнеризация
- **Kubernetes** - Оркестрация

## Поддержка и контакты

Для вопросов по user-service обращайтесь к команде backend разработки или создавайте issue в репозитории.

### Полезные ссылки
- [NestJS Documentation](https://docs.nestjs.com)
- [TypeORM Documentation](https://typeorm.io)
- [Cryo Integration Guide](./CRYO_INTEGRATION.md)
- [Docker Setup Guide](./DOCKER_SETUP_GUIDE.md)
