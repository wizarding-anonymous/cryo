# Microservices Backend

Этот проект содержит все микросервисы для игровой платформы, включая общую инфраструктуру для развертывания, мониторинга и управления.

## Архитектура

### Микросервисы

- **API Gateway** (порт 3000) - Основной шлюз для всех запросов
- **User Service** (порт 3001) - Управление пользователями
- **Game Catalog Service** (порт 3002) - Каталог игр
- **Library Service** (порт 3003) - Библиотека пользователей
- **Review Service** (порт 3004) - Отзывы и рейтинги
- **Payment Service** (порт 3005) - Платежная система
- **Notification Service** (порт 3006) - Уведомления
- **Social Service** (порт 3007) - Социальные функции
- **Achievement Service** (порт 3008) - Достижения
- **Security Service** (порт 3009) - Безопасность и аутентификация
- **Download Service** (порт 3010) - Загрузка файлов (Go)

### Инфраструктура

- **PostgreSQL** - Отдельные базы данных для каждого сервиса
- **Redis** - Кэширование и сессии
- **Prometheus** - Мониторинг метрик
- **Grafana** - Визуализация метрик
- **ELK Stack** - Централизованное логирование
- **Nginx** - Load balancer для продакшена

## Последние обновления

### Исправления инфраструктуры (22 сентября 2025)

**Текущий статус:**
- ✅ **Инфраструктура**: PostgreSQL (10 БД), Redis, Prometheus, Grafana работают
- ✅ **user-service**: Полностью исправлен и работает
- 🔄 **Остальные сервисы**: В процессе исправления конфигураций

**Выявленные системные проблемы:**
- 🚨 **Конфигурация .env файлов**: Неправильные хосты PostgreSQL и Redis
- 🚨 **Пароли Redis**: Отсутствуют во всех сервисах
- ⚠️ **Elasticsearch**: Проблемы с загрузкой образа (403 Forbidden)

**Исправления user-service:**
- Хост PostgreSQL: `postgres` → `postgres-user-db`
- Хост Redis: `redis` → `redis-cache`
- Добавлен пароль Redis: `redis_password`
- Исправлены учетные данные БД

**Health Endpoints (проверенные):**
- ✅ `user-service`: `/api/v1/health` - работает
- 🔄 Остальные сервисы требуют проверки после исправления конфигураций

## Быстрый старт

### Предварительные требования

- Docker и Docker Compose
- Node.js 20+
- Go 1.21+ (для download-service)
- Make (опционально)

### Установка

1. Клонируйте репозиторий:
```bash
git clone <repository-url>
cd backend
```

2. Запустите скрипт установки:
```bash
chmod +x scripts/setup.sh
./scripts/setup.sh
```

3. Или установите вручную:
```bash
make install
```

### Запуск

#### Режим разработки
```bash
make dev
# или
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

#### Продакшн режим
```bash
make prod
# или
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

#### Обычный режим
```bash
make up
# или
docker-compose up -d
```

## Управление

### Основные команды

```bash
# Сборка всех сервисов
make build

# Запуск всех сервисов
make up

# Остановка всех сервисов
make down

# Просмотр логов
make logs

# Просмотр логов конкретного сервиса
make logs-user-service

# Перезапуск всех сервисов
make restart

# Перезапуск конкретного сервиса
make restart-user-service

# Проверка статуса
make status

# Проверка здоровья сервисов
make health

# Очистка
make clean
```

### Тестирование

```bash
# Запуск всех тестов
make test

# Линтинг
make lint

# Форматирование кода
make format
```

### База данных

```bash
# Миграции
make db-migrate

# Заполнение тестовыми данными
make db-seed

# Бэкап баз данных
make backup
```

### Масштабирование

```bash
# Масштабирование конкретного сервиса
make scale-user-service REPLICAS=3
```

## Мониторинг

### Доступные интерфейсы

- **API Gateway**: http://localhost:3000
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3100 (admin/admin)
- **Kibana**: http://localhost:5601
- **PgAdmin** (dev): http://localhost:5050 (admin@admin.com/admin)
- **Redis Commander** (dev): http://localhost:8081

### Метрики

Каждый сервис экспортирует метрики на эндпоинте `/metrics`. Prometheus автоматически собирает метрики со всех сервисов.

### Логирование

Все логи централизованно собираются в Elasticsearch через Logstash и доступны в Kibana.

## Развертывание

### Docker Compose

Проект поддерживает три режима развертывания:

1. **Development** - с hot reload и инструментами разработки
2. **Production** - оптимизированный для продакшена
3. **Base** - базовая конфигурация

### Kubernetes

Конфигурации Kubernetes находятся в папке `k8s/`:

```bash
# Развертывание в Kubernetes
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/ingress.yaml
```

### CI/CD

Настроен GitHub Actions workflow для:

- Автоматического тестирования
- Сканирования безопасности
- Сборки Docker образов
- Развертывания в staging/production

## Конфигурация

### Переменные окружения

Каждый сервис имеет свой `.env` файл. **ВАЖНО**: После обновления конфигураций:

**Обязательные переменные для каждого сервиса:**
- `POSTGRES_HOST=postgres-[service]-db` - хост базы данных (НЕ `postgres`)
- `REDIS_HOST=redis-cache` - хост Redis (НЕ `redis`)
- `REDIS_PASSWORD=redis_password` - пароль Redis (НЕ пустой)
- `POSTGRES_USER=[service]_service` - пользователь БД согласно docker-compose.yml
- `POSTGRES_PASSWORD=[service]_password` - пароль БД согласно docker-compose.yml
- `POSTGRES_DB=[service]_db` - имя БД согласно docker-compose.yml

**Общие переменные:**
- `NODE_ENV` - окружение (development/production)
- `LOG_LEVEL` - уровень логирования
- `JWT_SECRET` - секрет для JWT токенов

**Пример правильной конфигурации (user-service):**
```env
POSTGRES_HOST=postgres-user-db
POSTGRES_USER=user_service
POSTGRES_PASSWORD=user_password
POSTGRES_DB=user_db
REDIS_HOST=redis-cache
REDIS_PASSWORD=redis_password
```

### Сети

Все сервисы работают в общей Docker сети `microservices-network` для внутреннего взаимодействия.

### Порты

| Сервис | Порт | Описание |
|--------|------|----------|
| API Gateway | 3000 | Основной API |
| User Service | 3001 | Пользователи |
| Game Catalog | 3002 | Каталог игр |
| Library Service | 3003 | Библиотека |
| Review Service | 3004 | Отзывы |
| Payment Service | 3005 | Платежи |
| Notification Service | 3006 | Уведомления |
| Social Service | 3007 | Социальные функции |
| Achievement Service | 3008 | Достижения |
| Security Service | 3009 | Безопасность |
| Download Service | 3010 | Загрузки |

## Разработка

### Добавление нового сервиса

1. Создайте папку сервиса в `backend/`
2. Добавьте сервис в `docker-compose.yml`
3. Обновите `Makefile` и скрипты
4. Добавьте конфигурации мониторинга
5. Обновите CI/CD pipeline

### Структура сервиса

```
service-name/
├── src/
├── test/
├── Dockerfile
├── docker-compose.yml
├── package.json
├── .env.example
└── README.md
```

### Стандарты кода

- ESLint для JavaScript/TypeScript
- Prettier для форматирования
- Jest для тестирования
- Swagger для документации API

## Безопасность

- JWT токены для аутентификации
- Rate limiting в Nginx
- HTTPS в продакшене
- Сканирование уязвимостей в CI/CD
- Изолированные базы данных для каждого сервиса

## Производительность

- Кэширование в Redis
- Connection pooling для баз данных
- Горизонтальное масштабирование
- Load balancing через Nginx
- Мониторинг производительности

## Устранение неполадок

### Общие проблемы

1. **Сервисы не запускаются**
   ```bash
   make logs
   docker-compose ps
   ```

2. **Ошибки подключения к базе данных**
   - Проверьте правильность хоста: должен быть `postgres-[service]-db`
   - Проверьте учетные данные согласно docker-compose.yml
   ```bash
   make logs-postgres-user
   docker-compose exec postgres-user-db psql -U user_service -d user_db
   ```

3. **Ошибки подключения к Redis**
   - Проверьте хост: должен быть `redis-cache`
   - Проверьте пароль: должен быть `redis_password`
   ```bash
   docker logs redis-cache
   docker exec redis-cache redis-cli -a redis_password ping
   ```

4. **Проблемы с сетью**
   ```bash
   docker network ls
   docker network inspect backend_microservices-network
   ```

5. **Config validation errors**
   - Обычно связаны с пустыми или неправильными переменными окружения
   - Проверьте .env файлы на соответствие шаблону
   ```bash
   docker exec [service] env | grep -E "(POSTGRES|REDIS)"
   ```

### Отладка

- Используйте `make logs-<service>` для просмотра логов конкретного сервиса
- Проверьте health endpoints: `curl http://localhost:3000/health`
- Мониторьте метрики в Grafana
- Проверяйте логи в Kibana

## Поддержка

Для получения помощи:

1. Проверьте документацию конкретного сервиса
2. Посмотрите логи и метрики
3. Создайте issue в репозитории
4. Обратитесь к команде разработки

## Лицензия

[Укажите лицензию проекта]