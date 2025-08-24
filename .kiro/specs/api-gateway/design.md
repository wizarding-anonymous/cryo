# Дизайн API Gateway

## Обзор

API Gateway является единой точкой входа для всех клиентских приложений российской игровой платформы. Сервис обеспечивает маршрутизацию запросов, аутентификацию, авторизацию, rate limiting, кэширование, агрегацию данных и мониторинг всех API вызовов.

### Ключевые принципы дизайна

- **Единая точка входа**: Все клиенты взаимодействуют только с Gateway
- **Высокая производительность**: Обработка до 100,000 RPS
- **Отказоустойчивость**: Circuit breaker и graceful degradation
- **Безопасность**: Централизованная аутентификация и авторизация
- **Наблюдаемость**: Полное логирование и трейсинг всех запросов

## Архитектура

### Общая архитектура

```mermaid
graph TB
    subgraph "Clients"
        Web[Web App]
        Desktop[Desktop Client]
        Mobile[Mobile App]
        API[External APIs]
    end
    
    subgraph "Load Balancer"
        LB[Nginx Load Balancer]
    end
    
    subgraph "API Gateway Cluster"
        GW1[Gateway Instance 1]
        GW2[Gateway Instance 2]
        GW3[Gateway Instance 3]
    end
    
    subgraph "Authentication"
        Auth[Auth Service]
        JWT[JWT Validation]
    end
    
    subgraph "Caching & Rate Limiting"
        Redis[(Redis Cluster)]
    end
    
    subgraph "Microservices"
        User[User Service]
        Game[Game Catalog]
        Payment[Payment Service]
        Library[Library Service]
        Social[Social Service]
        Download[Download Service]
        Achievement[Achievement Service]
        Review[Review Service]
    end
    
    subgraph "Monitoring"
        Metrics[Prometheus]
        Logs[ELK Stack]
        Tracing[Jaeger]
    end
    
    Web --> LB
    Desktop --> LB
    Mobile --> LB
    API --> LB
    
    LB --> GW1
    LB --> GW2
    LB --> GW3
    
    GW1 --> Auth
    GW1 --> Redis
    GW1 --> User
    GW1 --> Game
    GW1 --> Payment
    GW1 --> Library
    GW1 --> Social
    GW1 --> Download
    GW1 --> Achievement
    GW1 --> Review
    
    GW1 --> Metrics
    GW1 --> Logs
    GW1 --> Tracing
```

### Компонентная архитектура

```mermaid
graph TB
    subgraph "API Gateway"
        Router[Request Router]
        Auth[Authentication Middleware]
        RateLimit[Rate Limiting]
        Cache[Response Cache]
        Transform[Data Transformation]
        Aggregator[Response Aggregator]
        CircuitBreaker[Circuit Breaker]
        Monitor[Monitoring]
    end
    
    Router --> Auth
    Auth --> RateLimit
    RateLimit --> Cache
    Cache --> Transform
    Transform --> Aggregator
    Aggregator --> CircuitBreaker
    CircuitBreaker --> Monitor
```

## API Эндпоинты и маршруты

### Структура маршрутизации

```typescript
// Базовая структура URL
// https://api.gaming-platform.ru/v1/{service}/{resource}

// Маршруты пользователей
GET    /v1/users/profile              -> User Service
POST   /v1/users/register             -> User Service
POST   /v1/auth/login                 -> User Service

// Маршруты каталога игр
GET    /v1/games                      -> Game Catalog Service
GET    /v1/games/:id                  -> Game Catalog Service
GET    /v1/search/games               -> Game Catalog Service

// Маршруты библиотеки
GET    /v1/library/games              -> Library Service
POST   /v1/library/collections        -> Library Service
GET    /v1/library/stats              -> Library Service

// Маршруты платежей
POST   /v1/payments                   -> Payment Service
GET    /v1/payments/history           -> Payment Service
POST   /v1/wallet/topup               -> Payment Service

// Маршруты социальных функций
GET    /v1/friends                    -> Social Service
POST   /v1/friends/request            -> Social Service
GET    /v1/chat/conversations         -> Social Service

// Маршруты загрузок
POST   /v1/downloads                  -> Download Service
GET    /v1/downloads/queue            -> Download Service
PUT    /v1/downloads/:id/pause        -> Download Service

// Маршруты достижений
GET    /v1/achievements               -> Achievement Service
GET    /v1/leaderboards               -> Achievement Service
POST   /v1/achievements/events        -> Achievement Service

// Маршруты отзывов
GET    /v1/reviews                    -> Review Service
POST   /v1/reviews                    -> Review Service
GET    /v1/recommendations            -> Review Service

// Агрегированные эндпоинты
GET    /v1/dashboard                  -> Aggregated from multiple services
GET    /v1/user/summary               -> User + Library + Social
GET    /v1/game/:id/details           -> Game Catalog + Reviews + Achievements
```

### Middleware Pipeline

```typescript
interface MiddlewarePipeline {
  // 1. Request Logging
  requestLogger: (req: Request) => void
  
  // 2. CORS Headers
  corsHandler: (req: Request, res: Response) => void
  
  // 3. Rate Limiting
  rateLimiter: (req: Request) => Promise<boolean>
  
  // 4. Authentication
  authenticator: (req: Request) => Promise<User | null>
  
  // 5. Authorization
  authorizer: (req: Request, user: User) => Promise<boolean>
  
  // 6. Request Validation
  validator: (req: Request) => Promise<ValidationResult>
  
  // 7. Cache Check
  cacheChecker: (req: Request) => Promise<CachedResponse | null>
  
  // 8. Service Routing
  router: (req: Request) => Promise<ServiceResponse>
  
  // 9. Response Transformation
  transformer: (response: ServiceResponse) => Promise<APIResponse>
  
  // 10. Response Caching
  cacheWriter: (req: Request, response: APIResponse) => Promise<void>
  
  // 11. Response Logging
  responseLogger: (req: Request, res: Response) => void
}
```

## Модели данных

### Основные интерфейсы

```typescript
interface APIRequest {
  id: string // correlation ID
  method: string
  path: string
  headers: Record<string, string>
  query: Record<string, any>
  body: any
  user?: AuthenticatedUser
  timestamp: Date
  clientInfo: ClientInfo
}

interface APIResponse {
  success: boolean
  data?: any
  error?: APIError
  metadata: ResponseMetadata
  correlationId: string
  timestamp: Date
}

interface APIError {
  code: string
  message: string
  details?: any
  service?: string
  timestamp: Date
}

interface AuthenticatedUser {
  id: string
  username: string
  email: string
  roles: string[]
  permissions: string[]
  sessionId: string
}

interface ClientInfo {
  userAgent: string
  ipAddress: string
  platform: string
  version: string
  deviceId?: string
}

interface ServiceRoute {
  pattern: string
  service: string
  method: string
  requiresAuth: boolean
  permissions: string[]
  rateLimit: RateLimitConfig
  cacheConfig: CacheConfig
  timeout: number
}

interface RateLimitConfig {
  requests: number
  window: string // '1m', '1h', '1d'
  burst?: number
  skipSuccessfulRequests?: boolean
}

interface CacheConfig {
  enabled: boolean
  ttl: number
  varyBy: string[] // ['user', 'query', 'headers']
  invalidateOn: string[] // events that invalidate cache
}
```

## Детальная схема базы данных

```sql
-- Конфигурация маршрутов
CREATE TABLE api_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern VARCHAR(255) NOT NULL,
    service_name VARCHAR(100) NOT NULL,
    service_url VARCHAR(500) NOT NULL,
    method VARCHAR(10) NOT NULL,
    
    -- Аутентификация
    requires_auth BOOLEAN DEFAULT TRUE,
    required_permissions TEXT[] DEFAULT '{}',
    
    -- Rate limiting
    rate_limit_requests INTEGER DEFAULT 1000,
    rate_limit_window VARCHAR(10) DEFAULT '1h',
    rate_limit_burst INTEGER DEFAULT 100,
    
    -- Кэширование
    cache_enabled BOOLEAN DEFAULT FALSE,
    cache_ttl INTEGER DEFAULT 300, -- секунды
    cache_vary_by TEXT[] DEFAULT '{}',
    
    -- Таймауты
    timeout_seconds INTEGER DEFAULT 30,
    
    -- Статус
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Логи запросов
CREATE TABLE request_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    correlation_id VARCHAR(36) NOT NULL,
    
    -- Запрос
    method VARCHAR(10) NOT NULL,
    path VARCHAR(1000) NOT NULL,
    query_params JSONB DEFAULT '{}',
    headers JSONB DEFAULT '{}',
    
    -- Пользователь
    user_id UUID,
    session_id VARCHAR(255),
    
    -- Клиент
    ip_address INET NOT NULL,
    user_agent TEXT,
    client_platform VARCHAR(50),
    client_version VARCHAR(20),
    
    -- Маршрутизация
    target_service VARCHAR(100),
    service_response_time INTEGER, -- миллисекунды
    
    -- Ответ
    status_code INTEGER NOT NULL,
    response_size INTEGER DEFAULT 0,
    
    -- Ошибки
    error_code VARCHAR(50),
    error_message TEXT,
    
    -- Производительность
    total_time INTEGER NOT NULL, -- миллисекунды
    cache_hit BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- Rate limiting
CREATE TABLE rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_type VARCHAR(20) NOT NULL, -- 'user', 'ip', 'api_key'
    key_value VARCHAR(255) NOT NULL,
    route_pattern VARCHAR(255) NOT NULL,
    
    -- Лимиты
    requests_count INTEGER DEFAULT 0,
    window_start TIMESTAMP NOT NULL,
    window_end TIMESTAMP NOT NULL,
    
    -- Статус
    is_blocked BOOLEAN DEFAULT FALSE,
    blocked_until TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(key_type, key_value, route_pattern, window_start)
);

-- Кэш ответов (метаданные, сами данные в Redis)
CREATE TABLE response_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_key VARCHAR(255) UNIQUE NOT NULL,
    
    -- Запрос
    method VARCHAR(10) NOT NULL,
    path VARCHAR(1000) NOT NULL,
    query_hash VARCHAR(64) NOT NULL,
    
    -- Кэш
    ttl INTEGER NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    
    -- Метаданные
    content_type VARCHAR(100),
    content_size INTEGER,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- Статистика сервисов
CREATE TABLE service_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    hour INTEGER NOT NULL CHECK (hour >= 0 AND hour <= 23),
    
    -- Запросы
    total_requests INTEGER DEFAULT 0,
    successful_requests INTEGER DEFAULT 0,
    failed_requests INTEGER DEFAULT 0,
    
    -- Производительность
    avg_response_time INTEGER DEFAULT 0,
    p95_response_time INTEGER DEFAULT 0,
    p99_response_time INTEGER DEFAULT 0,
    
    -- Ошибки
    error_4xx_count INTEGER DEFAULT 0,
    error_5xx_count INTEGER DEFAULT 0,
    timeout_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(service_name, date, hour)
);

-- Индексы для производительности
CREATE INDEX idx_request_logs_correlation ON request_logs(correlation_id);
CREATE INDEX idx_request_logs_user_time ON request_logs(user_id, created_at DESC);
CREATE INDEX idx_request_logs_service_time ON request_logs(target_service, created_at DESC);
CREATE INDEX idx_request_logs_status_time ON request_logs(status_code, created_at DESC);
CREATE INDEX idx_request_logs_ip_time ON request_logs(ip_address, created_at DESC);

CREATE INDEX idx_rate_limits_key ON rate_limits(key_type, key_value, window_end);
CREATE INDEX idx_rate_limits_cleanup ON rate_limits(window_end) WHERE window_end < NOW();

CREATE INDEX idx_response_cache_expires ON response_cache(expires_at);
CREATE INDEX idx_response_cache_key ON response_cache(cache_key);

CREATE INDEX idx_service_stats_service_date ON service_stats(service_name, date DESC, hour DESC);

-- Функция для очистки старых данных
CREATE OR REPLACE FUNCTION cleanup_old_gateway_data()
RETURNS void AS $$
BEGIN
    -- Удаляем старые логи запросов (старше 30 дней)
    DELETE FROM request_logs WHERE created_at < NOW() - INTERVAL '30 days';
    
    -- Удаляем просроченные rate limits
    DELETE FROM rate_limits WHERE window_end < NOW() - INTERVAL '1 day';
    
    -- Удаляем просроченный кэш
    DELETE FROM response_cache WHERE expires_at < NOW();
    
    -- Агрегируем старую статистику (старше 7 дней) в дневную
    INSERT INTO service_stats (service_name, date, hour, total_requests, successful_requests, failed_requests, avg_response_time)
    SELECT 
        target_service,
        DATE(created_at),
        -1, -- специальное значение для дневной агрегации
        COUNT(*),
        COUNT(*) FILTER (WHERE status_code < 400),
        COUNT(*) FILTER (WHERE status_code >= 400),
        AVG(total_time)::INTEGER
    FROM request_logs 
    WHERE created_at < NOW() - INTERVAL '7 days'
    GROUP BY target_service, DATE(created_at)
    ON CONFLICT (service_name, date, hour) DO NOTHING;
END;
$$ LANGUAGE plpgsql;
```

## User Flows (Пользовательские сценарии)

### 1. Обработка API запроса

```mermaid
sequenceDiagram
    participant C as Client
    participant LB as Load Balancer
    participant GW as API Gateway
    participant Redis as Redis
    participant Auth as Auth Service
    participant MS as Microservice
    participant DB as PostgreSQL

    C->>LB: HTTP Request
    LB->>GW: Route to Gateway instance
    GW->>GW: Generate correlation ID
    GW->>DB: Log request start
    
    Note over GW: Rate Limiting Check
    GW->>Redis: Check rate limit for user/IP
    Redis->>GW: Rate limit status
    
    alt Rate limit exceeded
        GW->>C: 429 Too Many Requests
    else Within limits
        GW->>Redis: Increment rate limit counter
        
        Note over GW: Authentication
        GW->>GW: Extract JWT token
        GW->>Auth: Validate token
        Auth->>GW: User info + permissions
        
        Note over GW: Authorization
        GW->>GW: Check required permissions
        
        alt Unauthorized
            GW->>C: 401/403 Error
        else Authorized
            Note over GW: Cache Check
            GW->>Redis: Check response cache
            
            alt Cache hit
                Redis->>GW: Cached response
                GW->>C: Cached response + cache headers
            else Cache miss
                Note over GW: Service Call
                GW->>MS: Forward request
                MS->>GW: Service response
                
                alt Success response
                    GW->>Redis: Cache response (if cacheable)
                    GW->>GW: Transform response format
                    GW->>C: Transformed response
                else Service error
                    GW->>C: Standardized error response
                end
            end
        end
    end
    
    GW->>DB: Log request completion
```

### 2. Агрегация данных от нескольких сервисов

```mermaid
sequenceDiagram
    participant C as Client
    participant GW as API Gateway
    participant User as User Service
    participant Library as Library Service
    participant Social as Social Service
    participant Achievement as Achievement Service

    C->>GW: GET /v1/dashboard
    GW->>GW: Parse aggregation requirements
    
    Note over GW: Parallel service calls
    par User Profile
        GW->>User: GET /profile
        User->>GW: User profile data
    and Library Stats
        GW->>Library: GET /stats
        Library->>GW: Game statistics
    and Social Activity
        GW->>Social: GET /activity/recent
        Social->>GW: Recent social activity
    and Achievements
        GW->>Achievement: GET /recent
        Achievement->>GW: Recent achievements
    end
    
    GW->>GW: Aggregate all responses
    GW->>GW: Transform to dashboard format
    GW->>C: Aggregated dashboard data
```

### 3. Circuit Breaker Pattern

```mermaid
sequenceDiagram
    participant C as Client
    participant GW as API Gateway
    participant MS as Microservice
    participant CB as Circuit Breaker
    participant Cache as Fallback Cache

    loop Healthy service
        C->>GW: API Request
        GW->>CB: Check circuit state (CLOSED)
        CB->>MS: Forward request
        MS->>CB: Success response
        CB->>GW: Success response
        GW->>C: Response
    end
    
    Note over MS: Service starts failing
    
    loop Service failures
        C->>GW: API Request
        GW->>CB: Check circuit state (CLOSED)
        CB->>MS: Forward request
        MS->>CB: Error response
        CB->>CB: Increment failure count
        CB->>GW: Error response
        GW->>C: Error response
    end
    
    Note over CB: Failure threshold reached
    CB->>CB: Open circuit
    
    loop Circuit open
        C->>GW: API Request
        GW->>CB: Check circuit state (OPEN)
        CB->>Cache: Try fallback cache
        Cache->>CB: Cached/default response
        CB->>GW: Fallback response
        GW->>C: Fallback response (with warning header)
    end
    
    Note over CB: Half-open attempt
    CB->>CB: Transition to HALF_OPEN
    C->>GW: API Request
    GW->>CB: Check circuit state (HALF_OPEN)
    CB->>MS: Test request
    MS->>CB: Success response
    CB->>CB: Close circuit
    CB->>GW: Success response
    GW->>C: Normal response
```

### 4. Мониторинг и алертинг

```mermaid
sequenceDiagram
    participant GW as API Gateway
    participant Metrics as Prometheus
    participant Logs as ELK Stack
    participant Alert as AlertManager
    participant Ops as Operations Team

    loop Every request
        GW->>Metrics: Export metrics (latency, status, etc.)
        GW->>Logs: Send structured logs
    end
    
    Note over Metrics: Metrics analysis
    Metrics->>Metrics: Calculate error rate, latency percentiles
    
    alt High error rate detected
        Metrics->>Alert: Trigger alert
        Alert->>Ops: Send notification (Slack/Email)
        Ops->>Ops: Investigate issue
    end
    
    alt High latency detected
        Metrics->>Alert: Trigger latency alert
        Alert->>Ops: Send performance alert
        Ops->>GW: Check service health
    end
    
    Note over Logs: Log analysis
    Logs->>Logs: Analyze error patterns
    
    alt Suspicious activity pattern
        Logs->>Alert: Security alert
        Alert->>Ops: Send security notification
        Ops->>GW: Apply rate limiting/blocking
    end
```

Этот дизайн обеспечивает высокопроизводительный, безопасный и наблюдаемый API Gateway для российской игровой платформы с поддержкой всех необходимых функций маршрутизации, аутентификации, кэширования и мониторинга.