# Cryo - Российская игровая платформа

Cryo - это современная российская игровая платформа, построенная на микросервисной архитектуре с соблюдением российского законодательства.

## Архитектура проекта

Проект организован по принципу микросервисной архитектуры:

```
cryo/
├── backend/                    # Микросервисы backend
│   ├── user-service/          # Управление пользователями
│   ├── user-service-new/      # Обновленный User Service
│   └── [другие сервисы]/      # Будущие микросервисы
├── frontend/                   # Frontend приложения
├── docs/                      # Документация
├── k8s/                       # Kubernetes манифесты
├── helm/                      # Helm charts
└── .kiro/                     # Спецификации и конфигурация
```

## Микросервисы

### User Service (backend/user-service-new/)

Центральный микросервис для управления пользователями:

- ✅ Регистрация и аутентификация
- ✅ Управление профилями
- ✅ OAuth интеграция (VK, Yandex, Одноклассники)
- ✅ Многофакторная аутентификация
- ✅ Базовые профили разработчиков и издателей
- ✅ Система событий (Kafka)
- ✅ Соответствие 152-ФЗ

**Статус:** ✅ Готов к разработке (исправлены ошибки компиляции, все тесты проходят)

### Планируемые микросервисы

- **Game Catalog Service** - Каталог игр
- **Payment Service** - Платежи и биллинг
- **Library Service** - Библиотека пользователя
- **Social Service** - Социальные функции
- **Developer Portal Service** - Портал разработчиков
- **Notification Service** - Уведомления
- **Analytics Service** - Аналитика

## Технологический стек

### Backend
- **NestJS** - Основной фреймворк
- **TypeScript** - Язык программирования
- **PostgreSQL** - Основная база данных
- **Redis** - Кэширование и сессии
- **Apache Kafka** - Обмен событиями
- **Docker** - Контейнеризация
- **Kubernetes** - Оркестрация

### Frontend
- **React** - UI библиотека
- **TypeScript** - Язык программирования
- **Next.js** - Фреймворк
- **Tailwind CSS** - Стилизация

### Инфраструктура
- **Docker Compose** - Локальная разработка
- **Kubernetes** - Production окружение
- **Helm** - Управление деплоями
- **Prometheus** - Мониторинг
- **Grafana** - Визуализация метрик

## Быстрый старт

### Предварительные требования

- Node.js 18+
- Docker и Docker Compose
- PostgreSQL 15+
- Redis 7+

### Запуск User Service

1. Перейдите в папку сервиса:
```bash
cd backend/user-service-new
```

2. Установите зависимости:
```bash
npm install
```

3. Запустите инфраструктуру:
```bash
docker-compose up -d postgres redis kafka
```

4. Выполните миграции:
```bash
npm run migration:run
```

5. Запустите сервис:
```bash
npm run start:dev
```

API документация будет доступна по адресу: http://localhost:3001/api

### Запуск всего стека

```bash
# Запуск всех сервисов через Docker Compose
docker-compose up
```

## Разработка

### Структура микросервиса

Каждый микросервис следует принципам Hexagonal Architecture:

```
src/
├── application/          # Слой приложения
│   ├── services/        # Бизнес-логика
│   └── events/          # События и их схемы
├── domain/              # Доменный слой
│   ├── entities/        # Сущности
│   ├── value-objects/   # Объекты-значения
│   └── interfaces/      # Интерфейсы
├── infrastructure/      # Инфраструктурный слой
│   ├── auth/           # Аутентификация
│   ├── http/           # HTTP контроллеры
│   └── persistence/    # Работа с БД
└── modules/            # NestJS модули
```

### Добавление нового микросервиса

1. Создайте папку в `backend/`:
```bash
mkdir backend/new-service
```

2. Скопируйте структуру из User Service
3. Обновите package.json и конфигурацию
4. Создайте спецификацию в `.kiro/specs/`

### Тестирование

```bash
# Unit тесты
npm test

# E2E тесты
npm run test:e2e

# Покрытие
npm run test:cov
```

## Соответствие законодательству

Платформа полностью соответствует российскому законодательству:

- ✅ **152-ФЗ** - Защита персональных данных
- ✅ **ГОСТ шифрование** - Сертифицированные алгоритмы
- ✅ **Локализация данных** - Хранение в РФ
- ✅ **Аудит действий** - Полное логирование
- ✅ **Право на забвение** - Удаление данных по запросу

## Мониторинг и наблюдаемость

- **Structured Logging** - Структурированные логи
- **Distributed Tracing** - Трассировка запросов
- **Metrics** - Метрики Prometheus
- **Health Checks** - Проверки состояния
- **Alerting** - Система алертов

## Безопасность

- **JWT токены** - Аутентификация
- **RBAC** - Контроль доступа
- **Rate Limiting** - Защита от злоупотреблений
- **Input Validation** - Валидация входных данных
- **SQL Injection Protection** - Защита от SQL инъекций
- **CORS** - Настройка CORS политик

## Развертывание

### Development
```bash
docker-compose up
```

### Staging/Production
```bash
# Kubernetes
kubectl apply -f k8s/

# Или через Helm
helm install cryo ./helm/cryo
```

## Документация

- [API Documentation](docs/api/) - REST API документация
- [Architecture](docs/architecture.md) - Архитектура системы
- [Security](docs/security-review-checklist.md) - Безопасность
- [Runbook](docs/runbook.md) - Операционное руководство
- [Testing Plan](docs/testing-plan.md) - План тестирования

## Участие в разработке

1. Форкните репозиторий
2. Создайте feature ветку
3. Внесите изменения
4. Добавьте тесты
5. Создайте Pull Request

## Лицензия

MIT License - см. [LICENSE](LICENSE) файл.

## Контакты

- **Команда разработки:** Cryo Platform Team
- **Email:** dev@cryo-platform.ru
- **Документация:** https://docs.cryo-platform.ru

---

**Статус проекта:** 🚧 В активной разработке

**Последнее обновление:** Август 2025