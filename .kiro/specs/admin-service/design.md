# Дизайн Admin Service

## Обзор

Admin Service предоставляет централизованную панель администрирования для управления всей российской игровой платформой. Сервис обеспечивает единый интерфейс для управления пользователями, контентом, системными настройками, мониторинга всех микросервисов и бизнес-аналитики.

## Архитектура

### Высокоуровневая архитектура

```mermaid
graph TB
    Admin[Администраторы] --> WebUI[Admin Web UI]
    Admin --> MobileApp[Admin Mobile App]
    
    WebUI --> Gateway[API Gateway]
    MobileApp --> Gateway
    
    Gateway --> AS[Admin Service]
    
    AS --> DB[(PostgreSQL)]
    AS --> Cache[(Redis)]
    AS --> Queue[(RabbitMQ)]
    AS --> Analytics[(ClickHouse)]
    
    AS --> UserService[User Service]
    AS --> GameService[Game Catalog Service]
    AS --> PaymentService[Payment Service]
    AS --> SocialService[Social Service]
    AS --> SecurityService[Security Service]
    AS --> MonitoringService[Monitoring Service]
    AS --> NotificationService[Notification Service]
    
    AS --> External[Внешние системы]
    External --> Regulators[Регулирующие органы]
    External --> Analytics[Аналитические системы]
```

### Компоненты сервиса

1. **Admin Dashboard** - основной веб-интерфейс администрирования
2. **User Management** - управление пользователями и ролями
3. **Content Management** - управление контентом и модерацией
4. **System Configuration** - управление настройками системы
5. **Business Analytics** - бизнес-аналитика и отчетность
6. **Monitoring Dashboard** - мониторинг всех сервисов
7. **Compliance Tools** - инструменты соответствия законодательству
8. **Mobile Admin App** - мобильное приложение для критических операций

## Компоненты и интерфейсы

### API Endpoints

#### Управление пользователями
- `GET /api/v1/users` - список пользователей с фильтрацией
- `GET /api/v1/users/{userId}` - детальная информация о пользователе
- `PUT /api/v1/users/{userId}/block` - заблокировать пользователя
- `PUT /api/v1/users/{userId}/unblock` - разблокировать пользователя
- `POST /api/v1/users/bulk-operations` - массовые операции над пользователями

#### Управление контентом
- `GET /api/v1/content/moderation-queue` - очередь модерации
- `PUT /api/v1/content/{contentId}/approve` - одобрить контент
- `PUT /api/v1/content/{contentId}/reject` - отклонить контент
- `GET /api/v1/games/pending` - игры ожидающие модерации
- `POST /api/v1/content/bulk-moderate` - массовая модерация

#### Системное администрирование
- `GET /api/v1/system/services` - статус всех микросервисов
- `POST /api/v1/system/services/{serviceId}/restart` - перезапуск сервиса
- `GET /api/v1/system/configuration` - системная конфигурация
- `PUT /api/v1/system/configuration` - обновление конфигурации
- `POST /api/v1/system/maintenance` - режим технического обслуживания

#### Бизнес-аналитика
- `GET /api/v1/analytics/dashboard` - основные метрики дашборда
- `GET /api/v1/analytics/revenue` - финансовая аналитика
- `GET /api/v1/analytics/users` - пользовательская аналитика
- `GET /api/v1/analytics/games` - аналитика игр
- `POST /api/v1/reports/generate` - генерация отчетов

#### Финансовое управление
- `GET /api/v1/finance/transactions` - список транзакций
- `POST /api/v1/finance/payouts` - выплаты разработчикам
- `GET /api/v1/finance/reports` - финансовые отчеты
- `PUT /api/v1/finance/transactions/{transactionId}/refund` - возврат средств

#### Управление интеграциями
- `GET /api/v1/integrations` - список интеграций
- `PUT /api/v1/integrations/{integrationId}/configure` - настройка интеграции
- `POST /api/v1/integrations/{integrationId}/test` - тестирование интеграции
- `GET /api/v1/integrations/{integrationId}/logs` - логи интеграции

### Event-Driven Architecture

#### Входящие события
```typescript
interface SystemAlertEvent {
  alertId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  service: string;
  message: string;
  metadata: Record<string, any>;
  timestamp: Date;
}

interface UserActionEvent {
  userId: string;
  action: string;
  details: Record<string, any>;
  timestamp: Date;
  requiresAttention: boolean;
}
```

#### Исходящие события
```typescript
interface AdminActionEvent {
  adminId: string;
  action: string;
  targetType: 'user' | 'content' | 'system' | 'configuration';
  targetId: string;
  details: Record<string, any>;
  timestamp: Date;
}

interface SystemConfigurationChangeEvent {
  configKey: string;
  oldValue: any;
  newValue: any;
  changedBy: string;
  timestamp: Date;
}
```

## Модели данных

### Основные сущности

#### AdminUser (Администратор)
```typescript
interface AdminUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  roles: AdminRole[];
  permissions: Permission[];
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  mfaEnabled: boolean;
  sessionTimeout: number;
}

interface AdminRole {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  level: number;
}

interface Permission {
  id: string;
  resource: string;
  action: string;
  conditions?: Record<string, any>;
}
```

#### SystemConfiguration (Системная конфигурация)
```typescript
interface SystemConfiguration {
  id: string;
  key: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'json';
  category: string;
  description: string;
  isSecret: boolean;
  lastModifiedBy: string;
  lastModifiedAt: Date;
  version: number;
}
```

#### AdminAction (Действие администратора)
```typescript
interface AdminAction {
  id: string;
  adminId: string;
  action: string;
  targetType: string;
  targetId: string;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  result: 'success' | 'failure' | 'partial';
  errorMessage?: string;
}
```

#### Dashboard (Дашборд)
```typescript
interface Dashboard {
  id: string;
  name: string;
  description: string;
  widgets: DashboardWidget[];
  layout: DashboardLayout;
  permissions: Permission[];
  isDefault: boolean;
  createdBy: string;
  createdAt: Date;
}

interface DashboardWidget {
  id: string;
  type: 'chart' | 'metric' | 'table' | 'alert';
  title: string;
  dataSource: string;
  configuration: Record<string, any>;
  position: { x: number; y: number; width: number; height: number };
  refreshInterval: number;
}
```

### Схема базы данных

```sql
-- Администраторы
CREATE TABLE admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMP,
    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_secret VARCHAR(255),
    session_timeout INTEGER DEFAULT 3600,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Роли администраторов
CREATE TABLE admin_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    level INTEGER NOT NULL,
    permissions JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Связь администраторов и ролей
CREATE TABLE admin_user_roles (
    admin_id UUID NOT NULL REFERENCES admin_users(id),
    role_id UUID NOT NULL REFERENCES admin_roles(id),
    assigned_at TIMESTAMP DEFAULT NOW(),
    assigned_by UUID REFERENCES admin_users(id),
    PRIMARY KEY (admin_id, role_id)
);

-- Системная конфигурация
CREATE TABLE system_configuration (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(255) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    type config_type NOT NULL,
    category VARCHAR(100) NOT NULL,
    description TEXT,
    is_secret BOOLEAN DEFAULT FALSE,
    last_modified_by UUID REFERENCES admin_users(id),
    last_modified_at TIMESTAMP DEFAULT NOW(),
    version INTEGER DEFAULT 1
);

-- Действия администраторов (аудит)
CREATE TABLE admin_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES admin_users(id),
    action VARCHAR(255) NOT NULL,
    target_type VARCHAR(100) NOT NULL,
    target_id VARCHAR(255) NOT NULL,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP DEFAULT NOW(),
    result action_result NOT NULL,
    error_message TEXT
);

-- Дашборды
CREATE TABLE dashboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    widgets JSONB NOT NULL,
    layout JSONB NOT NULL,
    permissions JSONB,
    is_default BOOLEAN DEFAULT FALSE,
    created_by UUID NOT NULL REFERENCES admin_users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Алерты системы
CREATE TABLE system_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    severity alert_severity NOT NULL,
    service VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB,
    status alert_status DEFAULT 'active',
    acknowledged_by UUID REFERENCES admin_users(id),
    acknowledged_at TIMESTAMP,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## Безопасность

### Аутентификация и авторизация
```typescript
interface AdminAuthService {
  // Многофакторная аутентификация
  async authenticateWithMFA(username: string, password: string, mfaCode: string): Promise<AdminSession>;
  
  // Управление сессиями
  async createSession(adminId: string): Promise<AdminSession>;
  async validateSession(sessionToken: string): Promise<AdminUser>;
  async revokeSession(sessionToken: string): Promise<void>;
  
  // Проверка разрешений
  async hasPermission(adminId: string, resource: string, action: string): Promise<boolean>;
  async checkResourceAccess(adminId: string, resourceType: string, resourceId: string): Promise<boolean>;
}
```

### Аудит и логирование
```typescript
interface AuditService {
  async logAdminAction(action: AdminActionEvent): Promise<void>;
  async getAuditTrail(filters: AuditFilters): Promise<AdminAction[]>;
  async generateComplianceReport(period: DateRange): Promise<ComplianceReport>;
}
```

## Обработка ошибок

### Типы ошибок
```typescript
enum AdminErrorCode {
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  INVALID_CONFIGURATION = 'INVALID_CONFIGURATION',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  BULK_OPERATION_FAILED = 'BULK_OPERATION_FAILED',
  INTEGRATION_ERROR = 'INTEGRATION_ERROR',
  REPORT_GENERATION_FAILED = 'REPORT_GENERATION_FAILED'
}

interface AdminError {
  code: AdminErrorCode;
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
  adminId?: string;
}
```

## Стратегия тестирования

### Unit Tests
- Тестирование бизнес-логики управления
- Валидация разрешений и ролей
- Обработка конфигурации системы
- Генерация отчетов

### Integration Tests
- Интеграция со всеми микросервисами
- API endpoints
- Аутентификация и авторизация
- Обработка событий

### E2E Tests
- Полные сценарии администрирования
- Веб-интерфейс администратора
- Мобильное приложение
- Критические операции

### Security Tests
- Тестирование разрешений
- Проверка аудита действий
- Защита от несанкционированного доступа

## Производительность и масштабируемость

### Кэширование
- Redis для кэширования:
  - Сессии администраторов (TTL: 1 час)
  - Системная конфигурация (TTL: 15 минут)
  - Статистика дашбордов (TTL: 5 минут)
  - Разрешения пользователей (TTL: 30 минут)

### Оптимизация производительности
- Асинхронная обработка массовых операций
- Пагинация для больших списков
- Индексы для быстрого поиска
- Сжатие данных аналитики

### Горизонтальное масштабирование
- Stateless сервисы
- Load balancing для веб-интерфейса
- Распределенное кэширование
- Микросервисная архитектура

## Мониторинг и наблюдаемость

### Метрики
- Количество активных администраторов
- Время выполнения административных операций
- Частота использования различных функций
- Производительность интеграций

### Логирование
- Structured logging всех административных действий
- Аудит изменений конфигурации
- Логирование доступа к чувствительным данным
- Correlation ID для трассировки

### Алерты
- Подозрительная активность администраторов
- Сбои в критических интеграциях
- Превышение лимитов производительности
- Нарушения безопасности

### Дашборды
- Общая активность администраторов
- Статус всех микросервисов
- Бизнес-метрики платформы
- Compliance и аудит

## Развертывание

### Docker Configuration
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/
COPY public/ ./public/
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Kubernetes Deployment
- Deployment с высокой доступностью
- Ingress для веб-интерфейса
- ConfigMaps для конфигурации
- Secrets для чувствительных данных
- PersistentVolumes для логов аудита

### Environment Variables
```env
DATABASE_URL=postgresql://user:pass@host:5432/admin
REDIS_URL=redis://host:6379
JWT_SECRET=secret
SESSION_TIMEOUT=3600
MFA_ISSUER=Russian Gaming Platform
AUDIT_RETENTION_DAYS=2555
```