# User Service

Микросервис управления пользователями для российской игровой платформы.

## Описание

User Service является центральным микросервисом, отвечающим за:
- Регистрацию и аутентификацию пользователей
- Управление профилями пользователей
- Интеграцию с российскими OAuth провайдерами (VK, Yandex, Одноклассники)
- Многофакторную аутентификацию
- Управление сессиями
- Базовые профили разработчиков и издателей
- Соответствие 152-ФЗ о персональных данных

## Архитектура

Сервис построен на основе:
- **NestJS** - основной фреймворк
- **TypeORM** - ORM для работы с базой данных
- **PostgreSQL** - основная база данных
- **Redis** - кэширование и сессии
- **Apache Kafka** - обмен событиями между сервисами
- **Hexagonal Architecture** - чистая архитектура

## Установка и запуск

### Локальная разработка

1. Установите зависимости:
```bash
npm install
```

2. Скопируйте файл окружения:
```bash
cp .env.example .env
```

3. Запустите инфраструктуру через Docker Compose:
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

### Docker

Запуск всего стека:
```bash
docker-compose up
```

## API Документация

После запуска сервиса документация Swagger доступна по адресу:
http://localhost:3001/api

## Тестирование

```bash
# Unit тесты
npm test

# E2E тесты
npm run test:e2e

# Покрытие тестами
npm run test:cov
```

## Структура проекта

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
│   ├── auth/           # Аутентификация и авторизация
│   ├── http/           # HTTP контроллеры
│   └── persistence/    # Работа с базой данных
└── modules/            # NestJS модули
```

## Основные функции

### Аутентификация
- Регистрация по email/username
- Вход по логину/паролю
- OAuth интеграция (VK, Yandex, Одноклассники)
- JWT токены
- Многофакторная аутентификация (SMS, TOTP)

### Профили пользователей
- Базовые профили пользователей
- Профили разработчиков (базовая информация)
- Профили издателей (корпоративная информация)
- Корпоративные профили организаций
- Кастомизация профилей

### Безопасность
- ГОСТ-совместимое шифрование
- Аудит всех действий
- Соответствие 152-ФЗ
- Rate limiting
- Защита от DDoS

### Интеграция
- События Kafka для синхронизации с другими сервисами
- REST API для внешних интеграций
- Импорт данных из Steam, Epic Games

## Переменные окружения

```env
# База данных
DATABASE_URL=postgresql://user:password@localhost:5432/user_service

# Redis
REDIS_URL=redis://localhost:6379

# Kafka
KAFKA_BROKERS=localhost:9092

# JWT
JWT_SECRET=your-jwt-secret-key
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# OAuth провайдеры
VK_CLIENT_ID=your-vk-client-id
VK_CLIENT_SECRET=your-vk-client-secret
YANDEX_CLIENT_ID=your-yandex-client-id
YANDEX_CLIENT_SECRET=your-yandex-client-secret

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# SMS
SMS_PROVIDER_API_KEY=your-sms-api-key
```

## Мониторинг

Сервис экспортирует метрики для Prometheus:
- Количество активных пользователей
- Время отклика API
- Количество ошибок
- Использование ресурсов

## Развертывание

### Kubernetes

Используйте Helm chart из папки `helm/`:
```bash
helm install user-service ./helm/user-service
```

### Docker Swarm

```bash
docker stack deploy -c docker-compose.prod.yml user-service
```

## Лицензия

MIT License