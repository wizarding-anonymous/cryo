# Дизайн Achievement Service

## Обзор

Achievement Service является центральным сервисом для управления достижениями и статистикой игроков российской игровой платформы. Сервис построен на микросервисной архитектуре с использованием Node.js/TypeScript, PostgreSQL для основных данных, Redis для кэширования и RabbitMQ для обработки событий.

## Архитектура

### Высокоуровневая архитектура

```mermaid
graph TB
    Client[Клиентские приложения] --> Gateway[API Gateway]
    Gateway --> AS[Achievement Service]
    
    AS --> DB[(PostgreSQL)]
    AS --> Cache[(Redis)]
    AS --> Queue[(RabbitMQ)]
    
    AS --> GameService[Game Catalog Service]
    AS --> UserService[User Service]
    AS --> SocialService[Social Service]
    AS --> NotificationService[Notification Service]
    
    Queue --> EventProcessor[Event Processor]
    EventProcessor --> AS
```

### Компоненты сервиса

1. **Achievement API** - REST API для управления достижениями
2. **Event Processor** - обработка игровых событий
3. **Statistics Engine** - расчет статистики и рейтингов
4. **Reward System** - система наград за достижения
5. **Progress Tracker** - отслеживание прогресса пользователей

## Компоненты и интерфейсы

### API Endpoints

#### Достижения пользователей
- `GET /api/v1/users/{userId}/achievements` - получить достижения пользователя
- `GET /api/v1/users/{userId}/achievements/{achievementId}` - детали достижения
- `GET /api/v1/users/{userId}/progress` - прогресс по всем достижениям
- `POST /api/v1/users/{userId}/achievements/{achievementId}/unlock` - разблокировать достижение (внутренний)

#### Управление достижениями (для разработчиков)
- `POST /api/v1/games/{gameId}/achievements` - создать достижение
- `PUT /api/v1/games/{gameId}/achievements/{achievementId}` - обновить достижение
- `DELETE /api/v1/games/{gameId}/achievements/{achievementId}` - удалить достижение
- `GET /api/v1/games/{gameId}/achievements` - список достижений игры

#### Рейтинги и лидерборды
- `GET /api/v1/leaderboards/global` - глобальные рейтинги
- `GET /api/v1/leaderboards/friends/{userId}` - рейтинги среди друзей
- `GET /api/v1/leaderboards/games/{gameId}` - рейтинги по игре

#### События и статистика
- `POST /api/v1/events` - отправить игровое событие
- `GET /api/v1/games/{gameId}/analytics` - аналитика достижений для разработчиков
- `GET /api/v1/users/{userId}/statistics` - статистика пользователя

### Event-Driven Architecture

#### Входящие события
```typescript
interface GameEvent {
  userId: string;
  gameId: string;
  eventType: string;
  eventData: Record<string, any>;
  timestamp: Date;
  sessionId?: string;
}

interface UserEvent {
  userId: string;
  eventType: 'user_registered' | 'user_profile_updated' | 'user_blocked';
  eventData: Record<string, any>;
  timestamp: Date;
}
```

#### Исходящие события
```typescript
interface AchievementUnlockedEvent {
  userId: string;
  achievementId: string;
  gameId: string;
  timestamp: Date;
  isRare: boolean;
  reward?: {
    type: 'xp' | 'badge' | 'item';
    value: any;
  };
}

interface LeaderboardUpdateEvent {
  userId: string;
  gameId?: string;
  oldRank: number;
  newRank: number;
  category: string;
}
```

## Модели данных

### Основные сущности

#### Achievement (Достижение)
```typescript
interface Achievement {
  id: string;
  gameId: string;
  name: string;
  description: string;
  icon: string;
  type: 'single' | 'progress' | 'multi_stage';
  category: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  points: number;
  hidden: boolean;
  conditions: AchievementCondition[];
  rewards: AchievementReward[];
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

interface AchievementCondition {
  id: string;
  eventType: string;
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains';
  value: any;
  field?: string;
}

interface AchievementReward {
  type: 'xp' | 'badge' | 'item' | 'currency';
  value: any;
  description: string;
}
```

#### UserAchievement (Достижение пользователя)
```typescript
interface UserAchievement {
  id: string;
  userId: string;
  achievementId: string;
  gameId: string;
  progress: number;
  maxProgress: number;
  unlockedAt?: Date;
  currentStage?: number;
  isCompleted: boolean;
  metadata: Record<string, any>;
}
```

#### UserStatistics (Статистика пользователя)
```typescript
interface UserStatistics {
  userId: string;
  totalAchievements: number;
  totalPoints: number;
  rareAchievements: number;
  completionRate: number;
  averageCompletionTime: number;
  favoriteGenres: string[];
  lastActivityAt: Date;
  globalRank: number;
  gameStatistics: GameStatistics[];
}

interface GameStatistics {
  gameId: string;
  achievementsUnlocked: number;
  totalAchievements: number;
  completionRate: number;
  playtime: number;
  lastPlayedAt: Date;
}
```

#### Leaderboard (Рейтинг)
```typescript
interface LeaderboardEntry {
  userId: string;
  gameId?: string;
  category: string;
  score: number;
  rank: number;
  metadata: Record<string, any>;
  updatedAt: Date;
}
```

### Схема базы данных

```sql
-- Достижения
CREATE TABLE achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(500),
    type achievement_type NOT NULL,
    category VARCHAR(100),
    rarity achievement_rarity NOT NULL,
    points INTEGER DEFAULT 0,
    hidden BOOLEAN DEFAULT FALSE,
    conditions JSONB NOT NULL,
    rewards JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- Достижения пользователей
CREATE TABLE user_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    achievement_id UUID NOT NULL REFERENCES achievements(id),
    game_id UUID NOT NULL,
    progress INTEGER DEFAULT 0,
    max_progress INTEGER DEFAULT 1,
    unlocked_at TIMESTAMP,
    current_stage INTEGER DEFAULT 1,
    is_completed BOOLEAN DEFAULT FALSE,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, achievement_id)
);

-- Статистика пользователей
CREATE TABLE user_statistics (
    user_id UUID PRIMARY KEY,
    total_achievements INTEGER DEFAULT 0,
    total_points INTEGER DEFAULT 0,
    rare_achievements INTEGER DEFAULT 0,
    completion_rate DECIMAL(5,2) DEFAULT 0,
    average_completion_time INTEGER DEFAULT 0,
    favorite_genres JSONB,
    last_activity_at TIMESTAMP,
    global_rank INTEGER,
    game_statistics JSONB,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Рейтинги
CREATE TABLE leaderboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    game_id UUID,
    category VARCHAR(100) NOT NULL,
    score BIGINT NOT NULL,
    rank INTEGER,
    metadata JSONB,
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, game_id, category)
);

-- События для аудита
CREATE TABLE achievement_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    achievement_id UUID,
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## Обработка ошибок

### Типы ошибок
```typescript
enum AchievementErrorCode {
  ACHIEVEMENT_NOT_FOUND = 'ACHIEVEMENT_NOT_FOUND',
  ACHIEVEMENT_ALREADY_UNLOCKED = 'ACHIEVEMENT_ALREADY_UNLOCKED',
  INVALID_GAME_EVENT = 'INVALID_GAME_EVENT',
  INSUFFICIENT_PROGRESS = 'INSUFFICIENT_PROGRESS',
  ACHIEVEMENT_DISABLED = 'ACHIEVEMENT_DISABLED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INVALID_CONDITIONS = 'INVALID_CONDITIONS'
}

interface AchievementError {
  code: AchievementErrorCode;
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
}
```

### Стратегии обработки
- **Retry Logic**: для временных сбоев при обработке событий
- **Dead Letter Queue**: для событий, которые не удалось обработать
- **Circuit Breaker**: для защиты от каскадных сбоев
- **Graceful Degradation**: возврат кэшированных данных при недоступности БД

## Стратегия тестирования

### Unit Tests
- Тестирование бизнес-логики обработки достижений
- Валидация условий достижений
- Расчет прогресса и статистики
- Система наград

### Integration Tests
- Интеграция с базой данных
- Обработка событий через RabbitMQ
- API endpoints
- Кэширование в Redis

### Performance Tests
- Нагрузочное тестирование обработки событий (100K events/sec)
- Тестирование производительности рейтингов
- Масштабируемость при росте пользователей

### End-to-End Tests
- Полный цикл получения достижения
- Интеграция с другими сервисами
- Уведомления пользователей

## Безопасность

### Аутентификация и авторизация
- JWT токены для аутентификации
- RBAC для разграничения доступа разработчиков
- Rate limiting для предотвращения злоупотреблений

### Защита от мошенничества
- Валидация игровых событий
- Детекция аномальной активности
- Блокировка подозрительных аккаунтов
- Аудит всех операций с достижениями

### Шифрование данных
- Шифрование чувствительных данных в БД
- TLS для всех API вызовов
- Безопасное хранение API ключей

## Производительность и масштабируемость

### Кэширование
- Redis для кэширования:
  - Достижения пользователей (TTL: 1 час)
  - Рейтинги (TTL: 15 минут)
  - Статистика игр (TTL: 30 минут)
  - Метаданные достижений (TTL: 24 часа)

### Оптимизация базы данных
- Индексы для быстрого поиска:
  ```sql
  CREATE INDEX idx_user_achievements_user_game ON user_achievements(user_id, game_id);
  CREATE INDEX idx_achievements_game_active ON achievements(game_id, is_active);
  CREATE INDEX idx_leaderboards_category_rank ON leaderboards(category, rank);
  CREATE INDEX idx_user_statistics_rank ON user_statistics(global_rank);
  ```

### Горизонтальное масштабирование
- Stateless сервисы для легкого масштабирования
- Шардинг данных по user_id для больших объемов
- Read replicas для аналитических запросов
- Event sourcing для аудита и восстановления

### Мониторинг производительности
- Метрики времени обработки событий
- Мониторинг использования памяти и CPU
- Отслеживание размера очередей
- Алерты при превышении SLA

## Развертывание

### Docker Configuration
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Kubernetes Deployment
- Deployment с 3+ репликами для высокой доступности
- HorizontalPodAutoscaler для автомасштабирования
- ConfigMaps для конфигурации
- Secrets для чувствительных данных

### Environment Variables
```env
DATABASE_URL=postgresql://user:pass@host:5432/achievements
REDIS_URL=redis://host:6379
RABBITMQ_URL=amqp://user:pass@host:5672
JWT_SECRET=secret
API_RATE_LIMIT=1000
CACHE_TTL=3600
```

## Мониторинг и наблюдаемость

### Метрики
- Количество обработанных событий в секунду
- Время отклика API endpoints
- Процент успешных разблокировок достижений
- Размер очередей событий
- Использование кэша (hit rate)

### Логирование
- Structured logging в JSON формате
- Correlation ID для трассировки запросов
- Логирование всех изменений достижений
- Аудит подозрительной активности

### Алерты
- Превышение времени обработки событий (>100ms)
- Высокий процент ошибок (>1%)
- Переполнение очередей событий
- Недоступность зависимых сервисов

### Дашборды
- Общая статистика достижений
- Производительность обработки событий
- Топ игр по активности достижений
- Аналитика для разработчиков