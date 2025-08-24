# Дизайн Analytics Service

## Обзор

Analytics Service является центральным сервисом для сбора, обработки и анализа данных российской игровой платформы. Сервис обеспечивает real-time аналитику пользовательского поведения, бизнес-метрики, системную телеметрию и предоставляет инсайты для принятия решений.

### Ключевые принципы дизайна

- **Real-time обработка**: Потоковая обработка событий с минимальной задержкой
- **Масштабируемость**: Обработка миллионов событий в день
- **Гибкость**: Поддержка произвольных событий и метрик
- **Производительность**: Быстрые запросы к аналитическим данным
- **Приватность**: Соблюдение GDPR и российского законодательства

## Архитектура

### Общая архитектура

```mermaid
graph TB
    subgraph "Data Sources"
        Web[Web App]
        Desktop[Desktop Client]
        Mobile[Mobile App]
        Services[Microservices]
        Logs[System Logs]
    end
    
    subgraph "Data Ingestion"
        Kafka[Apache Kafka]
        Kinesis[AWS Kinesis]
        API[Analytics API]
    end
    
    subgraph "Analytics Service"
        Collector[Event Collector]
        Processor[Stream Processor]
        Aggregator[Data Aggregator]
        ML[ML Pipeline]
        Scheduler[Batch Jobs]
    end
    
    subgraph "Storage Layer"
        ClickHouse[(ClickHouse)]
        PostgreSQL[(PostgreSQL)]
        Redis[(Redis Cache)]
        S3[S3 Data Lake]
    end
    
    subgraph "Analytics APIs"
        RealtimeAPI[Real-time API]
        ReportsAPI[Reports API]
        DashboardAPI[Dashboard API]
        MLAPI[ML Insights API]
    end
    
    subgraph "Visualization"
        Grafana[Grafana]
        Superset[Apache Superset]
        CustomDash[Custom Dashboards]
    end
    
    Web --> API
    Desktop --> API
    Mobile --> API
    Services --> Kafka
    Logs --> Kinesis
    
    API --> Collector
    Kafka --> Processor
    Kinesis --> Processor
    
    Collector --> ClickHouse
    Processor --> Aggregator
    Aggregator --> ClickHouse
    Aggregator --> PostgreSQL
    
    ML --> S3
    Scheduler --> ClickHouse
    
    RealtimeAPI --> Redis
    ReportsAPI --> ClickHouse
    DashboardAPI --> PostgreSQL
    MLAPI --> S3
    
    Grafana --> RealtimeAPI
    Superset --> ReportsAPI
    CustomDash --> DashboardAPI
```

## API Эндпоинты и маршруты

### Event Collection API

```typescript
// Сбор событий
POST   /v1/events                      // Отправка одного события
POST   /v1/events/batch                // Пакетная отправка событий
POST   /v1/events/track                // Трекинг пользовательских действий
POST   /v1/events/page                 // Трекинг просмотров страниц

// Пользовательские сессии
POST   /v1/sessions/start              // Начало сессии
PUT    /v1/sessions/:id                // Обновление сессии
POST   /v1/sessions/:id/end            // Завершение сессии

// Конверсии и воронки
POST   /v1/conversions                 // Трекинг конверсий
POST   /v1/funnels/:id/step            // Шаг в воронке
```

### Analytics Query API

```typescript
// Real-time метрики
GET    /v1/metrics/realtime            // Текущие метрики
GET    /v1/metrics/realtime/:metric    // Конкретная метрика
GET    /v1/metrics/live-users          // Активные пользователи

// Исторические данные
GET    /v1/analytics/events            // Запрос событий
GET    /v1/analytics/users             // Аналитика пользователей
GET    /v1/analytics/games             // Аналитика игр
GET    /v1/analytics/revenue           // Финансовая аналитика

// Сегментация
GET    /v1/segments                    // Список сегментов
POST   /v1/segments                    // Создание сегмента
GET    /v1/segments/:id/users          // Пользователи в сегменте

// Воронки и когорты
GET    /v1/funnels                     // Анализ воронок
GET    /v1/cohorts                     // Когортный анализ
GET    /v1/retention                   // Анализ удержания
```

### Reports API

```typescript
// Предустановленные отчеты
GET    /v1/reports/daily               // Ежедневные отчеты
GET    /v1/reports/weekly              // Еженедельные отчеты
GET    /v1/reports/monthly             // Ежемесячные отчеты

// Кастомные отчеты
POST   /v1/reports/custom              // Создание отчета
GET    /v1/reports/:id                 // Получение отчета
PUT    /v1/reports/:id                 // Обновление отчета
DELETE /v1/reports/:id                 // Удаление отчета

// Экспорт данных
GET    /v1/export/events               // Экспорт событий
GET    /v1/export/users                // Экспорт пользователей
POST   /v1/export/custom               // Кастомный экспорт
```

## Модели данных

### Основные сущности

```typescript
interface AnalyticsEvent {
  id: string
  timestamp: Date
  
  // Пользователь
  userId?: string
  sessionId: string
  anonymousId?: string
  
  // Событие
  eventType: string
  eventName: string
  properties: Record<string, any>
  
  // Контекст
  context: EventContext
  
  // Метаданные
  receivedAt: Date
  processedAt?: Date
}

interface EventContext {
  // Устройство
  device: {
    type: 'desktop' | 'mobile' | 'tablet'
    os: string
    browser?: string
    version?: string
  }
  
  // Локация
  location: {
    country: string
    region?: string
    city?: string
    timezone: string
  }
  
  // Приложение
  app: {
    name: string
    version: string
    build?: string
  }
  
  // Сеть
  network: {
    ip: string
    userAgent: string
  }
  
  // Страница (для веб)
  page?: {
    url: string
    title: string
    referrer?: string
  }
}

interface UserSession {
  id: string
  userId?: string
  anonymousId: string
  
  // Сессия
  startedAt: Date
  endedAt?: Date
  duration?: number
  
  // Активность
  eventsCount: number
  pagesViewed: number
  
  // Контекст
  context: EventContext
  
  // Конверсии
  conversions: string[]
  revenue?: number
}

interface Metric {
  name: string
  value: number
  timestamp: Date
  dimensions: Record<string, string>
  tags: Record<string, string>
}

interface UserSegment {
  id: string
  name: string
  description: string
  
  // Условия сегментации
  conditions: SegmentCondition[]
  
  // Статистика
  userCount: number
  lastUpdated: Date
  
  createdAt: Date
  updatedAt: Date
}

interface SegmentCondition {
  field: string
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'in'
  value: any
  logicalOperator?: 'AND' | 'OR'
}

interface AnalyticsReport {
  id: string
  name: string
  description: string
  
  // Конфигурация
  query: ReportQuery
  schedule?: ReportSchedule
  
  // Результаты
  lastRunAt?: Date
  nextRunAt?: Date
  
  createdAt: Date
  updatedAt: Date
}

interface ReportQuery {
  metrics: string[]
  dimensions: string[]
  filters: QueryFilter[]
  dateRange: DateRange
  granularity: 'hour' | 'day' | 'week' | 'month'
}
```

## Детальная схема базы данных

### PostgreSQL (Метаданные и конфигурация)

```sql
-- Пользовательские сегменты
CREATE TABLE user_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    conditions JSONB NOT NULL,
    user_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Отчеты
CREATE TABLE analytics_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    query_config JSONB NOT NULL,
    schedule_config JSONB,
    last_run_at TIMESTAMP,
    next_run_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Дашборды
CREATE TABLE dashboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    config JSONB NOT NULL,
    is_public BOOLEAN DEFAULT FALSE,
    created_by UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Алерты
CREATE TABLE analytics_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    metric_name VARCHAR(255) NOT NULL,
    condition_operator VARCHAR(20) NOT NULL,
    threshold_value DECIMAL(15,4) NOT NULL,
    notification_channels TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    last_triggered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### ClickHouse (Аналитические данные)

```sql
-- События
CREATE TABLE events (
    id String,
    timestamp DateTime,
    user_id Nullable(String),
    session_id String,
    anonymous_id Nullable(String),
    
    -- Событие
    event_type String,
    event_name String,
    properties String, -- JSON
    
    -- Контекст
    device_type String,
    os String,
    browser Nullable(String),
    country String,
    region Nullable(String),
    city Nullable(String),
    
    -- Приложение
    app_name String,
    app_version String,
    
    -- Метаданные
    received_at DateTime,
    processed_at Nullable(DateTime),
    
    date Date MATERIALIZED toDate(timestamp)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (event_type, timestamp, user_id)
SETTINGS index_granularity = 8192;

-- Сессии пользователей
CREATE TABLE user_sessions (
    id String,
    user_id Nullable(String),
    anonymous_id String,
    
    started_at DateTime,
    ended_at Nullable(DateTime),
    duration Nullable(UInt32),
    
    events_count UInt32,
    pages_viewed UInt32,
    
    device_type String,
    os String,
    country String,
    
    conversions Array(String),
    revenue Nullable(Decimal(15,2)),
    
    date Date MATERIALIZED toDate(started_at)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (user_id, started_at)
SETTINGS index_granularity = 8192;

-- Агрегированные метрики по дням
CREATE TABLE daily_metrics (
    date Date,
    metric_name String,
    metric_value Float64,
    dimensions Map(String, String),
    
    updated_at DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(date)
ORDER BY (date, metric_name, dimensions)
SETTINGS index_granularity = 8192;

-- Материализованные представления для популярных запросов
CREATE MATERIALIZED VIEW daily_active_users
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (date, country, device_type)
AS SELECT
    date,
    country,
    device_type,
    uniqExact(user_id) as dau
FROM events
WHERE user_id IS NOT NULL
GROUP BY date, country, device_type;

CREATE MATERIALIZED VIEW hourly_events_stats
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (date, hour, event_type)
AS SELECT
    date,
    toHour(timestamp) as hour,
    event_type,
    count() as events_count,
    uniqExact(user_id) as unique_users
FROM events
GROUP BY date, hour, event_type;
```

## User Flows (Пользовательские сценарии)

### 1. Трекинг пользовательского события

```mermaid
sequenceDiagram
    participant C as Client App
    participant A as Analytics Service
    participant K as Kafka
    participant CH as ClickHouse
    participant R as Redis
    participant D as Dashboard

    C->>A: POST /v1/events/track
    A->>A: Валидация события
    A->>A: Обогащение контекстом
    A->>K: Публикация в Kafka
    A->>C: 200 OK (быстрый ответ)
    
    K->>A: Обработка события
    A->>CH: Сохранение в ClickHouse
    A->>R: Обновление real-time метрик
    
    Note over A: Проверка алертов
    A->>A: Проверка условий алертов
    alt Алерт сработал
        A->>A: Отправка уведомления
    end
    
    Note over D: Обновление дашбордов
    D->>R: Запрос real-time метрик
    R->>D: Актуальные данные
    D->>D: Обновление визуализации
```

### 2. Создание аналитического отчета

```mermaid
sequenceDiagram
    participant U as User
    participant UI as Analytics UI
    participant A as Analytics Service
    participant CH as ClickHouse
    participant P as PostgreSQL
    participant S as Scheduler

    U->>UI: Создает новый отчет
    UI->>A: POST /v1/reports/custom
    A->>A: Валидация запроса
    A->>P: Сохранение конфигурации отчета
    P->>A: ID отчета
    A->>UI: 201 Created + report ID
    
    U->>UI: Запускает отчет
    UI->>A: GET /v1/reports/:id/run
    A->>CH: Выполнение аналитического запроса
    CH->>A: Результаты запроса
    A->>A: Форматирование данных
    A->>UI: 200 OK + данные отчета
    UI->>U: Отображение результатов
    
    Note over U: Настройка расписания
    U->>UI: Настраивает автоматический запуск
    UI->>A: PUT /v1/reports/:id/schedule
    A->>P: Обновление расписания
    A->>S: Регистрация задачи
    S->>A: Подтверждение регистрации
    A->>UI: 200 OK
    
    Note over S: Автоматический запуск
    S->>A: Запуск отчета по расписанию
    A->>CH: Выполнение запроса
    CH->>A: Результаты
    A->>A: Отправка отчета по email/Slack
```

### 3. Real-time аналитика

```mermaid
sequenceDiagram
    participant E as Events
    participant K as Kafka
    participant SP as Stream Processor
    participant R as Redis
    participant WS as WebSocket
    participant D as Dashboard

    loop Поток событий
        E->>K: Поток событий
        K->>SP: Обработка потока
        SP->>SP: Агрегация в окнах времени
        SP->>R: Обновление метрик в Redis
    end
    
    Note over D: Подключение к real-time данным
    D->>WS: WebSocket соединение
    WS->>R: Подписка на обновления метрик
    
    loop Real-time обновления
        R->>WS: Уведомление об изменении метрик
        WS->>D: Отправка обновленных данных
        D->>D: Обновление графиков и счетчиков
    end
    
    Note over D: Запрос исторических данных
    D->>SP: GET /v1/metrics/realtime
    SP->>R: Запрос текущих метрик
    R->>SP: Актуальные значения
    SP->>D: 200 OK + метрики
```

### 4. Когортный анализ

```mermaid
sequenceDiagram
    participant A as Analyst
    participant UI as Analytics UI
    participant AS as Analytics Service
    participant CH as ClickHouse
    participant ML as ML Pipeline

    A->>UI: Запрос когортного анализа
    UI->>AS: GET /v1/cohorts?period=weekly
    AS->>CH: Сложный аналитический запрос
    
    Note over CH: Обработка когорт
    CH->>CH: Группировка пользователей по дате регистрации
    CH->>CH: Расчет retention по неделям
    CH->>CH: Агрегация данных по когортам
    
    CH->>AS: Результаты когортного анализа
    AS->>AS: Форматирование в таблицу когорт
    AS->>UI: 200 OK + cohort data
    UI->>A: Визуализация когортной таблицы
    
    Note over A: Запрос предсказаний
    A->>UI: Запрос ML предсказаний retention
    UI->>AS: GET /v1/ml/retention/predict
    AS->>ML: Запрос к ML модели
    ML->>ML: Предсказание retention на основе когорт
    ML->>AS: Предсказанные значения
    AS->>UI: 200 OK + predictions
    UI->>A: Отображение прогнозов
```

Этот дизайн обеспечивает мощную, масштабируемую систему аналитики для российской игровой платформы с поддержкой real-time обработки, сложных аналитических запросов и машинного обучения.