# Дизайн Game Catalog Service

## Обзор

Game Catalog Service является центральным сервисом для управления каталогом игр российской игровой платформы. Сервис обеспечивает хранение метаданных игр, поиск и фильтрацию, управление категориями, интеграцию с разработчиками и соблюдение российского законодательства о контенте.

### Ключевые принципы дизайна

- **Высокая производительность поиска**: Elasticsearch для быстрого полнотекстового поиска
- **Масштабируемость**: Горизонтальное масштабирование для обработки миллионов игр
- **Соответствие законодательству**: Автоматическая проверка контента на соответствие российским требованиям
- **Персонализация**: ML-алгоритмы для рекомендаций игр
- **Мультиязычность**: Поддержка множества языков с приоритетом русского

## Архитектура

### Общая архитектура

```mermaid
graph TB
    subgraph "External Services"
        Steam[Steam API]
        Epic[Epic Games API]
        GOG[GOG API]
        ML[ML Recommendation Engine]
        CDN[CDN для медиа]
    end
    
    subgraph "API Gateway"
        Gateway[API Gateway]
    end
    
    subgraph "Game Catalog Service"
        API[REST API]
        Search[Search Module]
        Catalog[Catalog Module]
        Moderation[Moderation Module]
        Analytics[Analytics Module]
        Events[Event Publisher]
        
        API --> Search
        API --> Catalog
        API --> Moderation
        API --> Analytics
        Search --> Events
        Catalog --> Events
        Moderation --> Events
    end
    
    subgraph "Data Layer"
        PostgreSQL[(PostgreSQL)]
        Elasticsearch[(Elasticsearch)]
        Redis[(Redis Cache)]
        S3[S3 Storage]
        Kafka[Apache Kafka]
    end
    
    subgraph "Other Services"
        User[User Service]
        Payment[Payment Service]
        Library[Library Service]
        Review[Review Service]
        Developer[Developer Portal]
    end
    
    Gateway --> API
    Search --> Steam
    Search --> Epic
    Search --> GOG
    Analytics --> ML
    Catalog --> CDN
    
    API --> PostgreSQL
    Search --> Elasticsearch
    API --> Redis
    Catalog --> S3
    Events --> Kafka
    
    Kafka --> User
    Kafka --> Payment
    Kafka --> Library
    Kafka --> Review
    Kafka --> Developer
```

### Модульная архитектура

```mermaid
graph TB
    subgraph "Presentation Layer"
        REST[REST Controllers]
        GraphQL[GraphQL API]
        WebSocket[WebSocket для real-time]
    end
    
    subgraph "Application Layer"
        CatalogService[Catalog Service]
        SearchService[Search Service]
        ModerationService[Moderation Service]
        RecommendationService[Recommendation Service]
        AnalyticsService[Analytics Service]
    end
    
    subgraph "Domain Layer"
        Game[Game Entity]
        Category[Category Entity]
        Tag[Tag Entity]
        Developer[Developer Entity]
        Review[Review Entity]
    end
    
    subgraph "Infrastructure Layer"
        GameRepo[Game Repository]
        SearchRepo[Search Repository]
        CacheRepo[Cache Repository]
        FileRepo[File Repository]
        EventRepo[Event Repository]
    end
    
    REST --> CatalogService
    GraphQL --> SearchService
    WebSocket --> RecommendationService
    
    CatalogService --> Game
    SearchService --> Game
    ModerationService --> Game
    
    Game --> GameRepo
    Category --> GameRepo
    Tag --> GameRepo
    
    GameRepo --> PostgreSQL
    SearchRepo --> Elasticsearch
    CacheRepo --> Redis
    FileRepo --> S3
    EventRepo --> Kafka
```

## API Эндпоинты и маршруты

### Структура API

```
Base URL: https://api.gaming-platform.ru/catalog-service/v1
```

### Public Catalog Endpoints

```typescript
// Просмотр каталога
GET    /games                      // Список игр с пагинацией и фильтрами
GET    /games/:id                  // Детальная информация об игре
GET    /games/:id/media            // Медиа файлы игры (скриншоты, видео)
GET    /games/:id/requirements     // Системные требования
GET    /games/:id/dlc              // DLC и дополнительный контент
GET    /games/:id/similar          // Похожие игры

// Поиск и фильтрация
GET    /search                     // Поиск игр
GET    /search/suggestions         // Автодополнение поиска
GET    /search/trending            // Трендовые поисковые запросы

// Категории и теги
GET    /categories                 // Иерархия категорий
GET    /categories/:id/games       // Игры в категории
GET    /tags                       // Список всех тегов
GET    /tags/:id/games            // Игры с определенным тегом

// Рекомендации
GET    /recommendations           // Персональные рекомендации
GET    /recommendations/popular   // Популярные игры
GET    /recommendations/new       // Новые игры
GET    /recommendations/discounted // Игры со скидками

// Топы и рейтинги
GET    /top/rated                 // Лучшие по рейтингу
GET    /top/selling               // Лидеры продаж
GET    /top/wishlist              // Самые желаемые
GET    /top/free                  // Бесплатные игры
```

### Developer Endpoints

```typescript
// Управление играми
POST   /developer/games           // Создание новой игры
GET    /developer/games           // Список игр разработчика
GET    /developer/games/:id       // Детали игры разработчика
PUT    /developer/games/:id       // Обновление игры
DELETE /developer/games/:id       // Удаление игры

// Медиа контент
POST   /developer/games/:id/media // Загрузка медиа файлов
PUT    /developer/games/:id/media/:mediaId // Обновление медиа
DELETE /developer/games/:id/media/:mediaId // Удаление медиа

// Версии и обновления
POST   /developer/games/:id/versions // Создание новой версии
GET    /developer/games/:id/versions // История версий
PUT    /developer/games/:id/versions/:versionId // Обновление версии

// DLC и дополнения
POST   /developer/games/:id/dlc   // Создание DLC
GET    /developer/games/:id/dlc   // Список DLC
PUT    /developer/games/:id/dlc/:dlcId // Обновление DLC

// Аналитика
GET    /developer/games/:id/analytics // Статистика игры
GET    /developer/analytics/overview // Общая статистика разработчика
GET    /developer/analytics/revenue  // Статистика доходов

// Модерация
POST   /developer/games/:id/submit // Отправка на модерацию
GET    /developer/games/:id/moderation // Статус модерации
```

### Admin/Moderation Endpoints

```typescript
// Модерация игр
GET    /admin/moderation/queue     // Очередь модерации
GET    /admin/moderation/games/:id // Детали игры для модерации
POST   /admin/moderation/games/:id/approve // Одобрение игры
POST   /admin/moderation/games/:id/reject  // Отклонение игры
POST   /admin/moderation/games/:id/request-changes // Запрос изменений

// Управление каталогом
GET    /admin/games                // Все игры с расширенными фильтрами
PUT    /admin/games/:id/featured   // Добавление в рекомендуемые
PUT    /admin/games/:id/ban        // Блокировка игры
PUT    /admin/games/:id/unban      // Разблокировка игры

// Категории и теги
POST   /admin/categories           // Создание категории
PUT    /admin/categories/:id       // Обновление категории
DELETE /admin/categories/:id       // Удаление категории
POST   /admin/tags                 // Создание тега
PUT    /admin/tags/:id             // Обновление тега
DELETE /admin/tags/:id             // Удаление тега

// Массовые операции
POST   /admin/games/bulk/update    // Массовое обновление игр
POST   /admin/games/bulk/categorize // Массовая категоризация
POST   /admin/games/bulk/tag       // Массовое добавление тегов

// Аналитика и отчеты
GET    /admin/analytics/catalog    // Аналитика каталога
GET    /admin/analytics/moderation // Статистика модерации
GET    /admin/reports/content      // Отчеты о контенте
```

### НОВЫЕ API Endpoints для расширенной функциональности

```typescript
// Предзаказы
GET    /games/:id/preorder         // Информация о предзаказе
POST   /games/:id/preorder         // Создание предзаказа (разработчик)
PUT    /games/:id/preorder         // Обновление предзаказа
DELETE /games/:id/preorder         // Отмена предзаказа
GET    /preorders/active           // Активные предзаказы

// Демо-версии
GET    /games/:id/demo             // Информация о демо
POST   /games/:id/demo/download    // Скачивание демо
GET    /games/:id/demo/stats       // Статистика демо
POST   /developer/games/:id/demo   // Создание демо (разработчик)

// Издания игр
GET    /games/:id/editions         // Все издания игры
GET    /games/:id/editions/compare // Сравнение изданий
POST   /games/:id/editions/upgrade // Апгрейд издания
POST   /developer/games/:id/editions // Создание издания

// DLC и дополнительный контент
GET    /games/:id/dlc              // Список DLC для игры
GET    /games/:id/dlc/:dlcId       // Информация о конкретном DLC
POST   /games/:id/dlc/:dlcId/purchase // Покупка DLC
GET    /games/:id/season-passes    // Сезонные пропуска
POST   /developer/games/:id/dlc    // Создание DLC

// Бандлы
GET    /bundles                    // Список всех бандлов
GET    /bundles/:bundleId          // Детали бандла
POST   /bundles/:bundleId/purchase // Покупка бандла
GET    /bundles/recommendations    // Рекомендуемые бандлы
POST   /admin/bundles              // Создание бандла (админ)
POST   /bundles/smart/generate     // Генерация умного бандла

// Франшизы
GET    /franchises                 // Список франшиз
GET    /franchises/:franchiseId    // Детали франшизы
GET    /franchises/:franchiseId/games // Игры франшизы
GET    /games/:id/franchise        // Франшиза игры

// Greenlight система
GET    /greenlight/games           // Игры на Greenlight
POST   /greenlight/submit          // Подача игры на Greenlight
POST   /greenlight/vote/:gameId    // Голосование за игру
GET    /greenlight/games/:gameId/votes // Результаты голосования
GET    /greenlight/my-submissions  // Мои заявки на Greenlight

// Интеграция с ключами
POST   /games/activate-key         // Активация игрового ключа
GET    /games/:id/key-info         // Информация о ключах игры
POST   /developer/games/:id/keys/generate // Генерация ключей
GET    /developer/games/:id/keys/stats    // Статистика активации ключей

// Система версий и статусов
GET    /games/:id/versions         // История версий игры
GET    /games/:id/status           // Текущий статус игры
PUT    /games/:id/status           // Изменение статуса (разработчик)
GET    /games/by-status/:status    // Игры по статусу

// Интеграция с обновлениями
POST   /games/:id/update-available // Уведомление о доступном обновлении
GET    /games/:id/changelog        // Список изменений
POST   /games/:id/roadmap          // Roadmap разработки (Early Access)
```

### Internal API Endpoints

```typescript
// Для других микросервисов
GET    /internal/games/:id         // Получение данных игры
POST   /internal/games/bulk        // Массовое получение игр
PUT    /internal/games/:id/stats   // Обновление статистики игры
POST   /internal/games/:id/purchase // Уведомление о покупке
POST   /internal/games/:id/review  // Уведомление о новом отзыве

// Новые внутренние эндпоинты
POST   /internal/games/:id/preorder-purchased // Уведомление о покупке предзаказа
POST   /internal/games/:id/demo-played        // Статистика игры в демо
POST   /internal/games/:id/key-activated       // Уведомление об активации ключа
GET    /internal/bundles/:bundleId/games       // Игры в бандле для других сервисов

// Синхронизация
POST   /internal/sync/steam        // Синхронизация со Steam
POST   /internal/sync/prices       // Синхронизация цен
POST   /internal/sync/ratings      // Синхронизация рейтингов

// Кэш управление
DELETE /internal/cache/games/:id   // Очистка кэша игры
DELETE /internal/cache/search      // Очистка поискового кэша
POST   /internal/cache/warm        // Прогрев кэша
```

## User Flows (Пользовательские сценарии)

### 1. Просмотр каталога игр

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant C as Catalog Service
    participant E as Elasticsearch
    participant R as Redis
    participant P as PostgreSQL

    U->>F: Открывает каталог игр
    F->>C: GET /games?page=1&limit=20
    C->>R: Проверка кэша каталога
    
    alt Кэш актуален
        R->>C: Данные из кэша
        C->>F: 200 OK + список игр
    else Кэш устарел
        C->>P: Запрос игр с метаданными
        C->>E: Запрос поисковых данных
        P->>C: Основные данные игр
        E->>C: Поисковые метрики
        C->>R: Обновление кэша
        C->>F: 200 OK + список игр
    end
    
    F->>U: Отображение каталога
    
    Note over U: Пользователь кликает на игру
    U->>F: Клик на игру
    F->>C: GET /games/:id
    C->>R: Проверка кэша игры
    
    alt Игра в кэше
        R->>C: Детальные данные игры
    else Игра не в кэше
        C->>P: Запрос полных данных игры
        P->>C: Детальная информация
        C->>R: Сохранение в кэш
    end
    
    C->>F: 200 OK + детали игры
    F->>U: Страница игры
```

### 2. Поиск игр

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant C as Catalog Service
    participant E as Elasticsearch
    participant R as Redis
    participant A as Analytics Service

    U->>F: Вводит поисковый запрос
    F->>C: GET /search?q=action+games&filters=...
    C->>R: Проверка кэша поиска
    
    alt Результаты в кэше
        R->>C: Кэшированные результаты
    else Новый поиск
        C->>E: Полнотекстовый поиск
        E->>C: Результаты поиска с релевантностью
        C->>R: Кэширование результатов
    end
    
    C->>A: Логирование поискового запроса
    C->>F: 200 OK + результаты поиска
    F->>U: Отображение результатов
    
    Note over U: Пользователь применяет фильтры
    U->>F: Выбирает фильтры (жанр, цена)
    F->>C: GET /search?q=action+games&genre=shooter&price=0-1000
    C->>E: Поиск с фильтрами
    E->>C: Отфильтрованные результаты
    C->>F: 200 OK + обновленные результаты
    F->>U: Обновленный список игр
```

### 3. Добавление игры разработчиком

```mermaid
sequenceDiagram
    participant D as Developer
    participant F as Developer Portal
    participant C as Catalog Service
    participant P as PostgreSQL
    participant S as S3 Storage
    participant M as Moderation Service
    participant K as Kafka

    D->>F: Создает новую игру
    F->>C: POST /developer/games
    C->>C: Валидация прав разработчика
    C->>P: Создание записи игры (статус: draft)
    P->>C: ID новой игры
    C->>F: 201 Created + game ID
    F->>D: Форма редактирования игры
    
    Note over D: Заполнение метаданных
    D->>F: Заполняет описание, теги, категории
    F->>C: PUT /developer/games/:id
    C->>C: Валидация данных
    C->>P: Обновление метаданных
    C->>F: 200 OK
    
    Note over D: Загрузка медиа файлов
    D->>F: Загружает скриншоты и видео
    F->>C: POST /developer/games/:id/media
    C->>C: Валидация файлов (размер, формат)
    C->>S: Загрузка в S3
    S->>C: URLs загруженных файлов
    C->>P: Сохранение URLs в БД
    C->>F: 200 OK + media URLs
    
    Note over D: Отправка на модерацию
    D->>F: Нажимает "Отправить на модерацию"
    F->>C: POST /developer/games/:id/submit
    C->>P: Обновление статуса (pending_moderation)
    C->>M: Добавление в очередь модерации
    C->>K: Событие GameSubmittedForModeration
    C->>F: 200 OK
    F->>D: Уведомление об отправке
```

### 4. Модерация игры

```mermaid
sequenceDiagram
    participant M as Moderator
    participant A as Admin Panel
    participant C as Catalog Service
    participant P as PostgreSQL
    participant E as Elasticsearch
    participant K as Kafka
    participant N as Notification Service

    M->>A: Открывает очередь модерации
    A->>C: GET /admin/moderation/queue
    C->>P: Запрос игр на модерации
    P->>C: Список игр для проверки
    C->>A: 200 OK + список игр
    A->>M: Отображение очереди
    
    M->>A: Выбирает игру для проверки
    A->>C: GET /admin/moderation/games/:id
    C->>P: Запрос полных данных игры
    P->>C: Детальная информация
    C->>A: 200 OK + данные для модерации
    A->>M: Форма модерации
    
    alt Игра одобрена
        M->>A: Одобряет игру
        A->>C: POST /admin/moderation/games/:id/approve
        C->>P: Обновление статуса (published)
        C->>E: Индексация игры для поиска
        C->>K: Событие GamePublished
        C->>A: 200 OK
        A->>M: Подтверждение одобрения
        
        K->>N: Уведомление разработчика
        N->>N: Отправка email об одобрении
        
    else Игра отклонена
        M->>A: Отклоняет с комментариями
        A->>C: POST /admin/moderation/games/:id/reject
        C->>P: Обновление статуса (rejected)
        C->>K: Событие GameRejected
        C->>A: 200 OK
        A->>M: Подтверждение отклонения
        
        K->>N: Уведомление разработчика
        N->>N: Отправка email с причинами отклонения
    end
```

### 5. Получение рекомендаций

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant C as Catalog Service
    participant R as Redis
    participant ML as ML Service
    participant US as User Service
    participant P as PostgreSQL

    U->>F: Запрашивает рекомендации
    F->>C: GET /recommendations (с JWT токеном)
    C->>C: Извлечение userId из токена
    C->>R: Проверка кэша рекомендаций
    
    alt Рекомендации в кэше
        R->>C: Кэшированные рекомендации
        C->>F: 200 OK + рекомендации
    else Нужно генерировать рекомендации
        C->>US: Запрос профиля пользователя
        US->>C: Предпочтения и история покупок
        C->>ML: Запрос рекомендаций на основе профиля
        ML->>C: Список рекомендованных игр
        C->>P: Получение метаданных рекомендованных игр
        P->>C: Детальная информация об играх
        C->>R: Кэширование рекомендаций (TTL 1 час)
        C->>F: 200 OK + персональные рекомендации
    end
    
    F->>U: Отображение рекомендаций
    
    Note over U: Пользователь кликает на рекомендованную игру
    U->>F: Клик на игру
    F->>C: GET /games/:id
    C->>ML: Логирование взаимодействия с рекомендацией
    C->>P: Запрос данных игры
    P->>C: Информация об игре
    C->>F: 200 OK + детали игры
    F->>U: Страница игры
```

### 6. Синхронизация с внешними источниками

```mermaid
sequenceDiagram
    participant S as Scheduler
    participant C as Catalog Service
    participant Steam as Steam API
    participant P as PostgreSQL
    participant E as Elasticsearch
    participant K as Kafka

    Note over S: Ежедневная синхронизация
    S->>C: Запуск синхронизации Steam
    C->>Steam: Запрос списка новых игр
    Steam->>C: Список игр с метаданными
    
    loop Для каждой новой игры
        C->>P: Проверка существования игры
        alt Игра не существует
            C->>P: Создание новой записи игры
            C->>E: Индексация для поиска
            C->>K: Событие GameImported
        else Игра существует
            C->>P: Обновление метаданных
            C->>E: Обновление поискового индекса
            C->>K: Событие GameUpdated
        end
    end
    
    C->>Steam: Запрос обновленных цен
    Steam->>C: Актуальные цены игр
    C->>P: Обновление цен в БД
    C->>K: Событие PricesUpdated
    
    C->>S: Отчет о синхронизации
    S->>S: Логирование результатов
```

## Модели данных

### Основные сущности

```typescript
interface Game {
  id: string
  
  // Основная информация
  title: string
  slug: string
  description: string
  shortDescription: string
  
  // Разработчик и издатель
  developerId: string
  publisherId: string
  developerName: string
  publisherName: string
  
  // Категоризация
  categories: Category[]
  tags: Tag[]
  genres: Genre[]
  
  // Медиа контент
  headerImage: string
  screenshots: Screenshot[]
  videos: Video[]
  
  // Цены и доступность
  price: Price
  discounts: Discount[]
  regions: Region[]
  
  // Системные требования
  systemRequirements: SystemRequirements
  
  // Рейтинги и отзывы
  rating: Rating
  reviewsCount: number
  
  // Возрастные ограничения
  ageRating: AgeRating
  contentWarnings: string[]
  
  // Локализация
  supportedLanguages: Language[]
  
  // Статус и метаданные
  status: GameStatus
  releaseDate: Date
  lastUpdated: Date
  version: string
  
  // Статистика
  viewsCount: number
  wishlistCount: number
  downloadCount: number
  
  // Внешние интеграции
  externalIds: ExternalId[]
  
  // Модерация
  moderationStatus: ModerationStatus
  moderationNotes: string
  
  // НОВЫЕ ФУНКЦИИ
  // Предзаказы
  preorderInfo?: PreorderInfo
  
  // Демо-версии
  demoInfo?: DemoInfo
  
  // Версии и издания
  editions: GameEdition[]
  
  // DLC и дополнительный контент
  dlcList: DLC[]
  seasonPasses: SeasonPass[]
  
  // Франшиза
  franchiseId?: string
  franchiseName?: string
  
  // Greenlight
  greenlightInfo?: GreenlightInfo
  
  // Интеграция с ключами
  keyActivationEnabled: boolean
  
  createdAt: Date
  updatedAt: Date
}

// Новые интерфейсы для расширенной функциональности

interface PreorderInfo {
  isAvailable: boolean
  startDate: Date
  releaseDate: Date
  estimatedReleaseDate?: Date
  tiers: PreorderTier[]
}

interface PreorderTier {
  id: string
  name: string // Standard, Deluxe, Ultimate
  price: number
  originalPrice: number
  discount: number
  bonuses: PreorderBonus[]
  earlyAccessDays?: number
}

interface PreorderBonus {
  type: 'digital_content' | 'physical_item' | 'early_access' | 'exclusive_content'
  name: string
  description: string
  imageUrl?: string
}

interface DemoInfo {
  isAvailable: boolean
  type: 'time_limited' | 'content_limited' | 'cloud_demo'
  timeLimit?: number // в минутах для time_limited
  contentDescription?: string // для content_limited
  downloadUrl?: string
  cloudStreamUrl?: string
  progressTransfer: boolean // можно ли перенести прогресс в полную версию
  conversionDiscount?: number // скидка при покупке после демо
}

interface GameEdition {
  id: string
  name: string // Standard, Deluxe, Collector's, GOTY, Complete
  price: number
  originalPrice?: number
  description: string
  includes: EditionContent[]
  isLimited: boolean
  limitedQuantity?: number
  availableFrom?: Date
  availableUntil?: Date
}

interface EditionContent {
  type: 'base_game' | 'dlc' | 'season_pass' | 'digital_content' | 'physical_item'
  name: string
  description: string
  value?: number
}

interface DLC {
  id: string
  gameId: string
  name: string
  description: string
  price: number
  releaseDate: Date
  type: 'expansion' | 'content_pack' | 'cosmetic' | 'character' | 'level'
  size: number // размер в MB
  requiredGameVersion?: string
  compatibleEditions: string[] // какие издания игры поддерживают этот DLC
  dependencies: string[] // другие DLC, которые нужны для этого
}

interface SeasonPass {
  id: string
  gameId: string
  name: string
  description: string
  price: number
  originalPrice: number
  includedDLC: string[] // ID DLC, которые входят в пропуск
  futureContent: string[] // описание будущего контента
  duration: number // длительность в месяцах
  savings: number // экономия в процентах
}

interface GreenlightInfo {
  isGreenlightGame: boolean
  submissionDate?: Date
  approvalDate?: Date
  votesFor: number
  votesAgainst: number
  totalVotes: number
  approvalThreshold: number
  status: 'submitted' | 'in_voting' | 'approved' | 'rejected'
  communityFeedback: GreenlightFeedback[]
}

interface GreenlightFeedback {
  userId: string
  vote: 'for' | 'against'
  comment?: string
  createdAt: Date
}

interface Franchise {
  id: string
  name: string
  description: string
  logoUrl: string
  games: string[] // ID игр во франшизе
  chronologicalOrder: FranchiseGame[]
  totalSales: number
  averageRating: number
}

interface FranchiseGame {
  gameId: string
  orderInSeries: number
  releaseDate: Date
  isMainSeries: boolean
  isRemaster: boolean
  originalGameId?: string // для ремастеров
}

interface Category {
  id: string
  name: string
  slug: string
  description?: string
  parentId?: string
  icon?: string
  sortOrder: number
  isActive: boolean
  gamesCount: number
  createdAt: Date
  updatedAt: Date
}

interface Tag {
  id: string
  name: string
  slug: string
  description?: string
  color?: string
  gamesCount: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

interface Screenshot {
  id: string
  gameId: string
  url: string
  thumbnailUrl: string
  caption?: string
  sortOrder: number
  createdAt: Date
}

interface Video {
  id: string
  gameId: string
  title: string
  url: string
  thumbnailUrl: string
  duration: number
  videoType: 'trailer' | 'gameplay' | 'review'
  sortOrder: number
  createdAt: Date
}

interface Price {
  basePrice: number
  currentPrice: number
  currency: string
  isFree: boolean
  discountPercentage?: number
  discountEndDate?: Date
}

interface SystemRequirements {
  minimum: {
    os: string
    processor: string
    memory: string
    graphics: string
    storage: string
    additional?: string
  }
  recommended: {
    os: string
    processor: string
    memory: string
    graphics: string
    storage: string
    additional?: string
  }
}

interface Rating {
  averageScore: number
  totalReviews: number
  distribution: {
    score1: number
    score2: number
    score3: number
    score4: number
    score5: number
  }
}
```

## Детальная схема базы данных

```sql
-- Игры
CREATE TABLE games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    short_description TEXT,
    
    -- Разработчик и издатель
    developer_id UUID NOT NULL,
    publisher_id UUID NOT NULL,
    developer_name VARCHAR(255) NOT NULL,
    publisher_name VARCHAR(255) NOT NULL,
    
    -- Медиа
    header_image VARCHAR(500),
    
    -- Цена
    base_price DECIMAL(10,2) DEFAULT 0,
    current_price DECIMAL(10,2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'RUB',
    is_free BOOLEAN DEFAULT FALSE,
    
    -- Системные требования (JSON)
    system_requirements JSONB,
    
    -- Рейтинг
    average_rating DECIMAL(3,2) DEFAULT 0,
    reviews_count INTEGER DEFAULT 0,
    
    -- Возрастные ограничения
    age_rating VARCHAR(10),
    content_warnings TEXT[],
    
    -- Поддерживаемые языки
    supported_languages JSONB DEFAULT '[]',
    
    -- Статус
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'published', 'rejected', 'archived')),
    release_date DATE,
    version VARCHAR(50),
    
    -- Статистика
    views_count BIGINT DEFAULT 0,
    wishlist_count BIGINT DEFAULT 0,
    download_count BIGINT DEFAULT 0,
    
    -- Внешние ID
    external_ids JSONB DEFAULT '{}',
    
    -- Модерация
    moderation_status VARCHAR(20) DEFAULT 'pending',
    moderation_notes TEXT,
    
    -- Метаданные
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Полнотекстовый поиск
    search_vector tsvector
);

-- Категории
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES categories(id),
    icon VARCHAR(500),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    games_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Теги
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    color VARCHAR(7), -- HEX цвет
    games_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Связь игр и категорий
CREATE TABLE game_categories (
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (game_id, category_id)
);

-- Связь игр и тегов
CREATE TABLE game_tags (
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (game_id, tag_id)
);

-- Скриншоты игр
CREATE TABLE game_screenshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    url VARCHAR(500) NOT NULL,
    thumbnail_url VARCHAR(500) NOT NULL,
    caption TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Видео игр
CREATE TABLE game_videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    url VARCHAR(500) NOT NULL,
    thumbnail_url VARCHAR(500) NOT NULL,
    duration INTEGER, -- в секундах
    video_type VARCHAR(20) DEFAULT 'trailer' CHECK (video_type IN ('trailer', 'gameplay', 'review')),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Скидки
CREATE TABLE game_discounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    discount_percentage INTEGER NOT NULL CHECK (discount_percentage > 0 AND discount_percentage <= 100),
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Региональная доступность
CREATE TABLE game_regions (
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    region_code VARCHAR(2) NOT NULL, -- ISO 3166-1 alpha-2
    is_available BOOLEAN DEFAULT TRUE,
    price_override DECIMAL(10,2),
    PRIMARY KEY (game_id, region_code)
);

-- Версии игр
CREATE TABLE game_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    version VARCHAR(50) NOT NULL,
    changelog TEXT,
    file_size BIGINT,
    download_url VARCHAR(500),
    is_current BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Индексы для производительности
CREATE INDEX idx_games_status ON games(status) WHERE status = 'published';
CREATE INDEX idx_games_release_date ON games(release_date DESC);
CREATE INDEX idx_games_rating ON games(average_rating DESC);
CREATE INDEX idx_games_price ON games(current_price);
CREATE INDEX idx_games_developer ON games(developer_id);
CREATE INDEX idx_games_search ON games USING GIN(search_vector);
CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_active ON categories(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_tags_active ON tags(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_game_screenshots_game ON game_screenshots(game_id, sort_order);
CREATE INDEX idx_game_videos_game ON game_videos(game_id, sort_order);
CREATE INDEX idx_game_discounts_active ON game_discounts(game_id, is_active, end_date) WHERE is_active = TRUE;

-- Триггер для обновления поискового вектора
CREATE OR REPLACE FUNCTION update_game_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('russian', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('russian', COALESCE(NEW.short_description, '')), 'B') ||
        setweight(to_tsvector('russian', COALESCE(NEW.description, '')), 'C') ||
        setweight(to_tsvector('russian', COALESCE(NEW.developer_name, '')), 'D');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER games_search_vector_update
    BEFORE INSERT OR UPDATE ON games
    FOR EACH ROW EXECUTE FUNCTION update_game_search_vector();

-- Триггер для обновления счетчика игр в категориях
CREATE OR REPLACE FUNCTION update_category_games_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE categories SET games_count = games_count + 1 WHERE id = NEW.category_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE categories SET games_count = games_count - 1 WHERE id = OLD.category_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER category_games_count_update
    AFTER INSERT OR DELETE ON game_categories
    FOR EACH ROW EXECUTE FUNCTION update_category_games_count();

-- Триггер для обновления счетчика игр в тегах
CREATE OR REPLACE FUNCTION update_tag_games_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE tags SET games_count = games_count + 1 WHERE id = NEW.tag_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE tags SET games_count = games_count - 1 WHERE id = OLD.tag_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tag_games_count_update
    AFTER INSERT OR DELETE ON game_tags
    FOR EACH ROW EXECUTE FUNCTION update_tag_games_count();
  moderatedBy: string
  moderatedAt: Date
  
  createdAt: Date
  updatedAt: Date
}

interface Category {
  id: string
  name: string
  slug: string
  description: string
  parentId?: string
  children: Category[]
  icon: string
  sortOrder: number
  isActive: boolean
}

interface Tag {
  id: string
  name: string
  slug: string
  description: string
  color: string
  gamesCount: number
  isActive: boolean
}

interface Price {
  currency: string
  basePrice: number
  currentPrice: number
  discountPercent: number
  isFree: boolean
  priceHistory: PriceHistory[]
}

interface SystemRequirements {
  windows?: PlatformRequirements
  mac?: PlatformRequirements
  linux?: PlatformRequirements
}

interface PlatformRequirements {
  minimum: Requirements
  recommended: Requirements
}

interface Requirements {
  os: string
  processor: string
  memory: string
  graphics: string
  directX?: string
  storage: string
  soundCard?: string
  additionalNotes?: string
}

interface Rating {
  average: number
  count: number
  distribution: RatingDistribution
}

interface Screenshot {
  id: string
  url: string
  thumbnailUrl: string
  caption?: string
  sortOrder: number
}

interface Video {
  id: string
  title: string
  url: string
  thumbnailUrl: string
  duration: number
  type: 'trailer' | 'gameplay' | 'review'
  sortOrder: number
}
```

## Детальная схема базы данных

```sql
-- Основная таблица игр
CREATE TABLE games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Основная информация
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    short_description TEXT,
    
    -- Разработчик и издатель
    developer_id UUID NOT NULL,
    publisher_id UUID,
    developer_name VARCHAR(255) NOT NULL,
    publisher_name VARCHAR(255),
    
    -- Медиа
    header_image VARCHAR(500),
    
    -- Цена и доступность
    base_price DECIMAL(10,2) DEFAULT 0,
    current_price DECIMAL(10,2) DEFAULT 0,
    currency CHAR(3) DEFAULT 'RUB',
    is_free BOOLEAN DEFAULT FALSE,
    
    -- Рейтинги
    rating_average DECIMAL(3,2) DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    reviews_count INTEGER DEFAULT 0,
    
    -- Возрастные ограничения
    age_rating VARCHAR(10), -- '0+', '6+', '12+', '16+', '18+'
    content_warnings TEXT[],
    
    -- Статус
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'pending_moderation', 'published', 'rejected', 'banned', 'archived')),
    release_date DATE,
    version VARCHAR(50),
    
    -- Статистика
    views_count BIGINT DEFAULT 0,
    wishlist_count BIGINT DEFAULT 0,
    download_count BIGINT DEFAULT 0,
    
    -- Модерация
    moderation_status VARCHAR(20) DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'approved', 'rejected', 'requires_changes')),
    moderation_notes TEXT,
    moderated_by UUID,
    moderated_at TIMESTAMP,
    
    -- Локализация
    supported_languages JSONB DEFAULT '[]',
    
    -- Внешние ID
    external_ids JSONB DEFAULT '{}', -- {"steam": "123456", "epic": "abc123"}
    
    -- Метаданные
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Индексы
    CONSTRAINT games_slug_check CHECK (slug ~* '^[a-z0-9-]+$')
);

-- Категории игр
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES categories(id),
    icon VARCHAR(255),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    games_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Теги игр
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL UNIQUE,
    slug VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#007bff', -- HEX цвет
    games_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Связь игр и категорий (многие ко многим)
CREATE TABLE game_categories (
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    
    PRIMARY KEY (game_id, category_id)
);

-- Связь игр и тегов (многие ко многим)
CREATE TABLE game_tags (
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    
    PRIMARY KEY (game_id, tag_id)
);

-- Скриншоты игр
CREATE TABLE game_screenshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    url VARCHAR(500) NOT NULL,
    thumbnail_url VARCHAR(500),
    caption VARCHAR(255),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Видео игр
CREATE TABLE game_videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    url VARCHAR(500) NOT NULL,
    thumbnail_url VARCHAR(500),
    duration INTEGER, -- в секундах
    video_type VARCHAR(20) DEFAULT 'trailer' CHECK (video_type IN ('trailer', 'gameplay', 'review', 'developer_diary')),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Системные требования
CREATE TABLE game_system_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    platform VARCHAR(20) NOT NULL CHECK (platform IN ('windows', 'mac', 'linux')),
    requirement_type VARCHAR(20) NOT NULL CHECK (requirement_type IN ('minimum', 'recommended')),
    
    -- Требования
    os VARCHAR(255),
    processor VARCHAR(255),
    memory VARCHAR(100),
    graphics VARCHAR(255),
    directx VARCHAR(50),
    storage VARCHAR(100),
    sound_card VARCHAR(255),
    additional_notes TEXT,
    
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(game_id, platform, requirement_type)
);

-- История цен
CREATE TABLE game_price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    old_price DECIMAL(10,2),
    new_price DECIMAL(10,2),
    currency CHAR(3) DEFAULT 'RUB',
    change_reason VARCHAR(50), -- 'discount', 'price_update', 'promotion'
    discount_percent INTEGER,
    valid_from TIMESTAMP DEFAULT NOW(),
    valid_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- DLC и дополнительный контент
CREATE TABLE game_dlc (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    dlc_game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    dlc_type VARCHAR(20) DEFAULT 'dlc' CHECK (dlc_type IN ('dlc', 'expansion', 'season_pass', 'cosmetic')),
    is_required BOOLEAN DEFAULT FALSE,
    release_order INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(parent_game_id, dlc_game_id)
);

-- Локализация игр
CREATE TABLE game_localizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    language_code CHAR(2) NOT NULL, -- 'ru', 'en', 'de', etc.
    
    -- Уровни локализации
    interface BOOLEAN DEFAULT FALSE,
    audio BOOLEAN DEFAULT FALSE,
    subtitles BOOLEAN DEFAULT FALSE,
    
    -- Переведенные поля
    title VARCHAR(255),
    description TEXT,
    short_description TEXT,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(game_id, language_code)
);

-- Рекомендуемые игры (для главной страницы)
CREATE TABLE featured_games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    feature_type VARCHAR(20) NOT NULL CHECK (feature_type IN ('hero_banner', 'daily_deal', 'editor_choice', 'trending')),
    title VARCHAR(255),
    description TEXT,
    banner_image VARCHAR(500),
    sort_order INTEGER DEFAULT 0,
    starts_at TIMESTAMP DEFAULT NOW(),
    ends_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(game_id, feature_type)
);

-- Статистика просмотров игр
CREATE TABLE game_view_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    views_count INTEGER DEFAULT 0,
    unique_views_count INTEGER DEFAULT 0,
    
    UNIQUE(game_id, date)
);

-- Кэш поисковых запросов
CREATE TABLE search_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_hash VARCHAR(64) NOT NULL UNIQUE, -- MD5 хэш запроса
    query_text TEXT NOT NULL,
    filters JSONB DEFAULT '{}',
    results JSONB NOT NULL,
    results_count INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL
);

-- Популярные поисковые запросы
CREATE TABLE search_trends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query TEXT NOT NULL,
    search_count INTEGER DEFAULT 1,
    date DATE DEFAULT CURRENT_DATE,
    
    UNIQUE(query, date)
);

-- Индексы для производительности
CREATE INDEX idx_games_status ON games(status) WHERE status = 'published';
CREATE INDEX idx_games_developer ON games(developer_id);
CREATE INDEX idx_games_release_date ON games(release_date);
CREATE INDEX idx_games_rating ON games(rating_average DESC);
CREATE INDEX idx_games_price ON games(current_price);
CREATE INDEX idx_games_created_at ON games(created_at);
CREATE INDEX idx_games_views ON games(views_count DESC);
CREATE INDEX idx_games_wishlist ON games(wishlist_count DESC);

CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_active ON categories(is_active) WHERE is_active = TRUE;

CREATE INDEX idx_tags_active ON tags(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_tags_games_count ON tags(games_count DESC);

CREATE INDEX idx_game_categories_game ON game_categories(game_id);
CREATE INDEX idx_game_categories_category ON game_categories(category_id);
CREATE INDEX idx_game_categories_primary ON game_categories(is_primary) WHERE is_primary = TRUE;

CREATE INDEX idx_game_tags_game ON game_tags(game_id);
CREATE INDEX idx_game_tags_tag ON game_tags(tag_id);

CREATE INDEX idx_screenshots_game ON game_screenshots(game_id, sort_order);
CREATE INDEX idx_videos_game ON game_videos(game_id, sort_order);

CREATE INDEX idx_requirements_game_platform ON game_system_requirements(game_id, platform);

CREATE INDEX idx_price_history_game ON game_price_history(game_id, created_at);

CREATE INDEX idx_dlc_parent ON game_dlc(parent_game_id);
CREATE INDEX idx_dlc_child ON game_dlc(dlc_game_id);

CREATE INDEX idx_localizations_game_lang ON game_localizations(game_id, language_code);

CREATE INDEX idx_featured_active ON featured_games(is_active, feature_type, sort_order) WHERE is_active = TRUE;
CREATE INDEX idx_featured_dates ON featured_games(starts_at, ends_at);

CREATE INDEX idx_view_stats_game_date ON game_view_stats(game_id, date);
CREATE INDEX idx_view_stats_date ON game_view_stats(date);

CREATE INDEX idx_search_cache_hash ON search_cache(query_hash);
CREATE INDEX idx_search_cache_expires ON search_cache(expires_at);

CREATE INDEX idx_search_trends_date ON search_trends(date, search_count DESC);

-- Полнотекстовый поиск
CREATE INDEX idx_games_search ON games USING gin(to_tsvector('russian', title || ' ' || COALESCE(description, '')));

-- Триггеры для автоматического обновления
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_games_updated_at BEFORE UPDATE ON games
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_localizations_updated_at BEFORE UPDATE ON game_localizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Функция для обновления счетчиков
CREATE OR REPLACE FUNCTION update_category_games_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE categories SET games_count = games_count + 1 WHERE id = NEW.category_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE categories SET games_count = games_count - 1 WHERE id = OLD.category_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_category_games_count
    AFTER INSERT OR DELETE ON game_categories
    FOR EACH ROW EXECUTE FUNCTION update_category_games_count();

CREATE OR REPLACE FUNCTION update_tag_games_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE tags SET games_count = games_count + 1 WHERE id = NEW.tag_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE tags SET games_count = games_count - 1 WHERE id = OLD.tag_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_tag_games_count
    AFTER INSERT OR DELETE ON game_tags
    FOR EACH ROW EXECUTE FUNCTION update_tag_games_count();

-- Функция очистки просроченного кэша
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
    DELETE FROM search_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
```

### Elasticsearch Schema

```json
{
  "mappings": {
    "properties": {
      "id": { "type": "keyword" },
      "title": {
        "type": "text",
        "analyzer": "russian",
        "fields": {
          "keyword": { "type": "keyword" },
          "suggest": { "type": "completion" }
        }
      },
      "description": {
        "type": "text",
        "analyzer": "russian"
      },
      "developer_name": {
        "type": "text",
        "analyzer": "russian",
        "fields": { "keyword": { "type": "keyword" } }
      },
      "categories": {
        "type": "nested",
        "properties": {
          "id": { "type": "keyword" },
          "name": { "type": "keyword" },
          "slug": { "type": "keyword" }
        }
      },
      "tags": {
        "type": "nested",
        "properties": {
          "id": { "type": "keyword" },
          "name": { "type": "keyword" },
          "slug": { "type": "keyword" }
        }
      },
      "price": { "type": "float" },
      "rating": { "type": "float" },
      "release_date": { "type": "date" },
      "supported_languages": { "type": "keyword" },
      "age_rating": { "type": "keyword" },
      "is_free": { "type": "boolean" },
      "views_count": { "type": "long" },
      "wishlist_count": { "type": "long" },
      "created_at": { "type": "date" },
      "updated_at": { "type": "date" }
    }
  },
  "settings": {
    "analysis": {
      "analyzer": {
        "russian": {
          "tokenizer": "standard",
          "filter": ["lowercase", "russian_morphology", "russian_stop"]
        }
      }
    }
  }
}
```

Этот дизайн обеспечивает высокую производительность поиска, масштабируемость и соответствие всем требованиям для Game Catalog Service российской игровой платформы.
## Расшире
нная функциональность

### Система предзаказов

```typescript
interface PreorderSystem {
  // Уровни предзаказов
  tiers: {
    standard: {
      price: number
      bonuses: string[]
      earlyAccess: false
    }
    deluxe: {
      price: number
      bonuses: string[]
      earlyAccess: true
      earlyAccessDays: 3
    }
    ultimate: {
      price: number
      bonuses: string[]
      earlyAccess: true
      earlyAccessDays: 7
      exclusiveContent: string[]
    }
  }
  
  // Управление предзаказами
  createPreorder(gameId: string, tier: PreorderTier): Promise<Preorder>
  updatePreorderTier(preorderId: string, newTier: PreorderTier): Promise<void>
  cancelPreorder(preorderId: string): Promise<RefundInfo>
  processPreorderRelease(gameId: string): Promise<void>
}

// Дополнительные таблицы БД
CREATE TABLE game_preorders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id),
    tier VARCHAR(20) NOT NULL CHECK (tier IN ('standard', 'deluxe', 'ultimate')),
    price DECIMAL(10,2) NOT NULL,
    bonuses JSONB DEFAULT '[]',
    early_access_days INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_preorders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    game_id UUID NOT NULL REFERENCES games(id),
    preorder_tier VARCHAR(20) NOT NULL,
    amount_paid DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'fulfilled')),
    created_at TIMESTAMP DEFAULT NOW(),
    fulfilled_at TIMESTAMP
);
```

### Система демо-версий

```typescript
interface DemoSystem {
  // Типы демо
  types: {
    time_limited: {
      duration: number // минуты
      features: 'full'
    }
    content_limited: {
      levels: number
      features: string[]
    }
    cloud_demo: {
      streaming: true
      duration: number
    }
  }
  
  // Управление демо
  createDemo(gameId: string, demoType: DemoType, config: DemoConfig): Promise<Demo>
  trackDemoUsage(userId: string, gameId: string, sessionData: DemoSession): Promise<void>
  convertDemoToFullGame(userId: string, gameId: string, discount?: number): Promise<ConversionOffer>
}

// Таблицы БД для демо
CREATE TABLE game_demos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id),
    demo_type VARCHAR(20) NOT NULL CHECK (demo_type IN ('time_limited', 'content_limited', 'cloud_demo')),
    config JSONB NOT NULL,
    download_url VARCHAR(500),
    file_size BIGINT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE demo_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    game_id UUID NOT NULL REFERENCES games(id),
    demo_id UUID NOT NULL REFERENCES game_demos(id),
    session_duration INTEGER, -- секунды
    progress_data JSONB,
    converted_to_purchase BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Система версий и изданий игр

```typescript
interface GameEditionSystem {
  // Типы изданий
  editions: {
    standard: {
      baseGame: true
      dlc: []
      bonuses: []
    }
    deluxe: {
      baseGame: true
      dlc: string[]
      bonuses: string[]
      seasonPass: boolean
    }
    collectors: {
      baseGame: true
      dlc: string[]
      bonuses: string[]
      physicalItems: string[]
      digitalArt: boolean
    }
    goty: {
      baseGame: true
      allDlc: true
      bonuses: string[]
      awards: string[]
    }
  }
  
  // Управление изданиями
  createEdition(gameId: string, editionType: EditionType, content: EditionContent): Promise<GameEdition>
  compareEditions(gameId: string): Promise<EditionComparison>
  upgradeEdition(userId: string, gameId: string, fromEdition: string, toEdition: string): Promise<UpgradeOffer>
}

// Таблицы БД для изданий
CREATE TABLE game_editions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id),
    edition_type VARCHAR(20) NOT NULL CHECK (edition_type IN ('standard', 'deluxe', 'collectors', 'goty')),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    content JSONB NOT NULL, -- список DLC, бонусов и т.д.
    is_available BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE edition_dlc (
    edition_id UUID NOT NULL REFERENCES game_editions(id),
    dlc_id UUID NOT NULL REFERENCES games(id), -- DLC тоже игры
    is_included BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (edition_id, dlc_id)
);
```

### Система бандлов

```typescript
interface BundleSystem {
  // Типы бандлов
  types: {
    publisher: {
      games: string[] // игры одного издателя
      discount: number
    }
    franchise: {
      games: string[] // игры одной серии
      discount: number
    }
    themed: {
      games: string[] // игры по теме
      discount: number
    }
    smart: {
      userId: string // персональный бандл
      aiGenerated: true
      discount: number
    }
  }
  
  // Управление бандлами
  createBundle(type: BundleType, games: string[], discount: number): Promise<Bundle>
  calculateBundlePrice(bundleId: string, userId: string): Promise<BundlePricing>
  generateSmartBundle(userId: string): Promise<Bundle>
}

// Таблицы БД для бандлов
CREATE TABLE game_bundles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    bundle_type VARCHAR(20) NOT NULL CHECK (bundle_type IN ('publisher', 'franchise', 'themed', 'smart')),
    base_discount DECIMAL(5,2) NOT NULL, -- процент скидки
    is_active BOOLEAN DEFAULT TRUE,
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE bundle_games (
    bundle_id UUID NOT NULL REFERENCES game_bundles(id),
    game_id UUID NOT NULL REFERENCES games(id),
    sort_order INTEGER DEFAULT 0,
    PRIMARY KEY (bundle_id, game_id)
);

CREATE TABLE user_bundle_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    bundle_id UUID NOT NULL REFERENCES game_bundles(id),
    total_price DECIMAL(10,2) NOT NULL,
    discount_applied DECIMAL(10,2) NOT NULL,
    games_owned_before INTEGER DEFAULT 0, -- сколько игр уже было у пользователя
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Интеграция с системой ключей

```typescript
interface GameKeySystem {
  // Типы ключей
  keyTypes: {
    retail: {
      source: 'retail_partner'
      region: string
      restrictions: string[]
    }
    promotional: {
      source: 'promotion'
      limitations: string[]
      expiry: Date
    }
    review: {
      source: 'press_review'
      reviewer: string
      restrictions: string[]
    }
  }
  
  // Активация ключей
  validateKey(key: string): Promise<KeyValidation>
  activateKey(userId: string, key: string): Promise<KeyActivation>
  generateKeys(gameId: string, count: number, type: KeyType): Promise<string[]>
}

// Таблицы БД для ключей
CREATE TABLE game_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id),
    key_code VARCHAR(255) UNIQUE NOT NULL,
    key_type VARCHAR(20) NOT NULL CHECK (key_type IN ('retail', 'promotional', 'review')),
    region_code VARCHAR(2), -- ISO код региона
    restrictions JSONB DEFAULT '[]',
    is_used BOOLEAN DEFAULT FALSE,
    used_by UUID, -- user_id
    used_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_game_keys_code ON game_keys(key_code);
CREATE INDEX idx_game_keys_game_unused ON game_keys(game_id, is_used) WHERE is_used = FALSE;
```

### Интеграция с Greenlight системой

```typescript
interface GreenlightIntegration {
  // Статусы Greenlight
  statuses: {
    submitted: 'Подана на голосование'
    voting: 'Идет голосование'
    approved: 'Одобрена сообществом'
    rejected: 'Отклонена сообществом'
    graduated: 'Выпущена в каталог'
  }
  
  // Управление Greenlight
  submitToGreenlight(gameId: string): Promise<GreenlightSubmission>
  getVotingResults(gameId: string): Promise<VotingResults>
  graduateFromGreenlight(gameId: string): Promise<void>
}

// Таблицы БД для Greenlight
CREATE TABLE greenlight_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id),
    status VARCHAR(20) DEFAULT 'submitted' CHECK (status IN ('submitted', 'voting', 'approved', 'rejected', 'graduated')),
    votes_yes INTEGER DEFAULT 0,
    votes_no INTEGER DEFAULT 0,
    total_votes INTEGER DEFAULT 0,
    approval_threshold INTEGER DEFAULT 1000,
    submission_date TIMESTAMP DEFAULT NOW(),
    voting_end_date TIMESTAMP,
    graduated_at TIMESTAMP
);

CREATE TABLE greenlight_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES greenlight_submissions(id),
    user_id UUID NOT NULL,
    vote BOOLEAN NOT NULL, -- true = yes, false = no
    comment TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(submission_id, user_id)
);
```

### Система статусов жизненного цикла

```typescript
interface GameLifecycleSystem {
  // Статусы жизненного цикла
  statuses: {
    in_development: {
      visible: false
      purchasable: false
      features: ['wishlist']
    }
    alpha: {
      visible: true
      purchasable: false
      features: ['wishlist', 'early_access_signup']
    }
    beta: {
      visible: true
      purchasable: true
      features: ['wishlist', 'beta_access']
      warnings: ['beta_warning']
    }
    coming_soon: {
      visible: true
      purchasable: false
      features: ['wishlist', 'preorder']
    }
    preorder: {
      visible: true
      purchasable: true
      features: ['preorder_tiers']
    }
    early_access: {
      visible: true
      purchasable: true
      features: ['early_access_warning', 'roadmap']
    }
    released: {
      visible: true
      purchasable: true
      features: ['full_features']
    }
    discontinued: {
      visible: true
      purchasable: false
      features: ['legacy_support']
    }
  }
  
  // Управление статусами
  updateGameStatus(gameId: string, newStatus: GameStatus, metadata?: any): Promise<void>
  getStatusHistory(gameId: string): Promise<StatusHistory[]>
  scheduleStatusChange(gameId: string, status: GameStatus, scheduledDate: Date): Promise<void>
}

// Таблицы БД для статусов
CREATE TABLE game_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id),
    old_status VARCHAR(20),
    new_status VARCHAR(20) NOT NULL,
    changed_by UUID, -- user_id кто изменил
    change_reason TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE scheduled_status_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id),
    target_status VARCHAR(20) NOT NULL,
    scheduled_date TIMESTAMP NOT NULL,
    is_executed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## Обработка ошибок

### Стратегия обработки ошибок

```typescript
enum ErrorCodes {
  // Общие ошибки
  GAME_NOT_FOUND = 'GAME_NOT_FOUND',
  INVALID_GAME_DATA = 'INVALID_GAME_DATA',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  
  // Ошибки модерации
  MODERATION_PENDING = 'MODERATION_PENDING',
  MODERATION_REJECTED = 'MODERATION_REJECTED',
  INSUFFICIENT_MODERATION_RIGHTS = 'INSUFFICIENT_MODERATION_RIGHTS',
  
  // Ошибки поиска
  SEARCH_SERVICE_UNAVAILABLE = 'SEARCH_SERVICE_UNAVAILABLE',
  INVALID_SEARCH_QUERY = 'INVALID_SEARCH_QUERY',
  
  // Ошибки интеграции
  EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR',
  SYNC_CONFLICT = 'SYNC_CONFLICT',
  
  // Ошибки файлов
  INVALID_FILE_FORMAT = 'INVALID_FILE_FORMAT',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  UPLOAD_FAILED = 'UPLOAD_FAILED'
}

interface ErrorResponse {
  error: {
    code: ErrorCodes
    message: string
    details?: any
    timestamp: string
    requestId: string
  }
}

class GameCatalogError extends Error {
  constructor(
    public code: ErrorCodes,
    message: string,
    public details?: any
  ) {
    super(message)
    this.name = 'GameCatalogError'
  }
}
```

## Стратегия тестирования

### Unit тесты

```typescript
// Тестирование бизнес-логики
describe('GameService', () => {
  describe('createGame', () => {
    it('should create game with valid data', async () => {
      const gameData = {
        title: 'Test Game',
        description: 'Test Description',
        developerId: 'dev-123'
      }
      
      const result = await gameService.createGame(gameData)
      
      expect(result.id).toBeDefined()
      expect(result.title).toBe('Test Game')
      expect(result.status).toBe('draft')
    })
    
    it('should throw error for invalid data', async () => {
      const invalidData = { title: '' }
      
      await expect(gameService.createGame(invalidData))
        .rejects.toThrow(GameCatalogError)
    })
  })
  
  describe('searchGames', () => {
    it('should return relevant games for query', async () => {
      const query = 'action games'
      const filters = { genre: 'action' }
      
      const results = await searchService.searchGames(query, filters)
      
      expect(results.games).toHaveLength(10)
      expect(results.total).toBeGreaterThan(0)
    })
  })
})
```

### Integration тесты

```typescript
describe('Game Catalog API Integration', () => {
  describe('GET /games', () => {
    it('should return paginated games list', async () => {
      const response = await request(app)
        .get('/games?page=1&limit=10')
        .expect(200)
      
      expect(response.body.games).toHaveLength(10)
      expect(response.body.pagination).toBeDefined()
    })
  })
  
  describe('POST /developer/games', () => {
    it('should create game for authenticated developer', async () => {
      const gameData = {
        title: 'New Game',
        description: 'Game Description'
      }
      
      const response = await request(app)
        .post('/developer/games')
        .set('Authorization', `Bearer ${developerToken}`)
        .send(gameData)
        .expect(201)
      
      expect(response.body.id).toBeDefined()
      expect(response.body.title).toBe('New Game')
    })
  })
})
```

### E2E тесты

```typescript
describe('Game Catalog E2E', () => {
  it('should complete full game publication flow', async () => {
    // 1. Разработчик создает игру
    const createResponse = await createGame(developerToken, gameData)
    const gameId = createResponse.body.id
    
    // 2. Загружает медиа файлы
    await uploadGameMedia(developerToken, gameId, mediaFiles)
    
    // 3. Отправляет на модерацию
    await submitForModeration(developerToken, gameId)
    
    // 4. Модератор одобряет игру
    await approveGame(moderatorToken, gameId)
    
    // 5. Игра появляется в каталоге
    const catalogResponse = await request(app)
      .get('/games')
      .expect(200)
    
    const publishedGame = catalogResponse.body.games
      .find(game => game.id === gameId)
    
    expect(publishedGame).toBeDefined()
    expect(publishedGame.status).toBe('published')
  })
})
```

## Развертывание

### Docker конфигурация

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM node:18-alpine AS runtime

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "dist/main.js"]
```

### Kubernetes манифесты

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: game-catalog-service
  labels:
    app: game-catalog-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: game-catalog-service
  template:
    metadata:
      labels:
        app: game-catalog-service
    spec:
      containers:
      - name: game-catalog-service
        image: game-catalog-service:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: game-catalog-secrets
              key: database-url
        - name: ELASTICSEARCH_URL
          valueFrom:
            configMapKeyRef:
              name: game-catalog-config
              key: elasticsearch-url
        - name: REDIS_URL
          valueFrom:
            configMapKeyRef:
              name: game-catalog-config
              key: redis-url
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: game-catalog-service
spec:
  selector:
    app: game-catalog-service
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: ClusterIP
```

### CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy Game Catalog Service

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      
      elasticsearch:
        image: elasticsearch:8.5.0
        env:
          discovery.type: single-node
          xpack.security.enabled: false
        options: >-
          --health-cmd "curl http://localhost:9200/_cluster/health"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 10
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run linting
      run: npm run lint
    
    - name: Run unit tests
      run: npm run test:unit
    
    - name: Run integration tests
      run: npm run test:integration
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
        ELASTICSEARCH_URL: http://localhost:9200
    
    - name: Run E2E tests
      run: npm run test:e2e
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
        ELASTICSEARCH_URL: http://localhost:9200

  build:
    needs: test
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Build Docker image
      run: docker build -t game-catalog-service:${{ github.sha }} .
    
    - name: Push to registry
      run: |
        echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
        docker push game-catalog-service:${{ github.sha }}

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Deploy to Kubernetes
      run: |
        kubectl set image deployment/game-catalog-service game-catalog-service=game-catalog-service:${{ github.sha }}
        kubectl rollout status deployment/game-catalog-service
```
-- НОВ
ЫЕ ТАБЛИЦЫ ДЛЯ РАСШИРЕННОЙ ФУНКЦИОНАЛЬНОСТИ

-- Предзаказы
CREATE TABLE game_preorders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    is_available BOOLEAN DEFAULT TRUE,
    start_date TIMESTAMP NOT NULL,
    release_date TIMESTAMP NOT NULL,
    estimated_release_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Уровни предзаказов
CREATE TABLE preorder_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    preorder_id UUID NOT NULL REFERENCES game_preorders(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL, -- Standard, Deluxe, Ultimate
    price DECIMAL(10,2) NOT NULL,
    original_price DECIMAL(10,2) NOT NULL,
    discount_percentage INTEGER DEFAULT 0,
    early_access_days INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Бонусы предзаказов
CREATE TABLE preorder_bonuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tier_id UUID NOT NULL REFERENCES preorder_tiers(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('digital_content', 'physical_item', 'early_access', 'exclusive_content')),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    image_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Демо-версии
CREATE TABLE game_demos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    is_available BOOLEAN DEFAULT TRUE,
    demo_type VARCHAR(20) NOT NULL CHECK (demo_type IN ('time_limited', 'content_limited', 'cloud_demo')),
    time_limit_minutes INTEGER, -- для time_limited
    content_description TEXT, -- для content_limited
    download_url VARCHAR(500),
    cloud_stream_url VARCHAR(500),
    progress_transfer BOOLEAN DEFAULT FALSE,
    conversion_discount INTEGER DEFAULT 0,
    download_count BIGINT DEFAULT 0,
    play_count BIGINT DEFAULT 0,
    conversion_rate DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Издания игр
CREATE TABLE game_editions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- Standard, Deluxe, Collector's, GOTY, Complete
    price DECIMAL(10,2) NOT NULL,
    original_price DECIMAL(10,2),
    description TEXT,
    is_limited BOOLEAN DEFAULT FALSE,
    limited_quantity INTEGER,
    available_from TIMESTAMP,
    available_until TIMESTAMP,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Содержимое изданий
CREATE TABLE edition_contents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    edition_id UUID NOT NULL REFERENCES game_editions(id) ON DELETE CASCADE,
    content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('base_game', 'dlc', 'season_pass', 'digital_content', 'physical_item')),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    value DECIMAL(10,2),
    sort_order INTEGER DEFAULT 0
);

-- DLC
CREATE TABLE game_dlc (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    release_date DATE,
    dlc_type VARCHAR(20) NOT NULL CHECK (dlc_type IN ('expansion', 'content_pack', 'cosmetic', 'character', 'level')),
    size_mb BIGINT,
    required_game_version VARCHAR(50),
    download_count BIGINT DEFAULT 0,
    rating_average DECIMAL(3,2) DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Совместимость DLC с изданиями
CREATE TABLE dlc_edition_compatibility (
    dlc_id UUID NOT NULL REFERENCES game_dlc(id) ON DELETE CASCADE,
    edition_id UUID NOT NULL REFERENCES game_editions(id) ON DELETE CASCADE,
    PRIMARY KEY (dlc_id, edition_id)
);

-- Зависимости DLC
CREATE TABLE dlc_dependencies (
    dlc_id UUID NOT NULL REFERENCES game_dlc(id) ON DELETE CASCADE,
    required_dlc_id UUID NOT NULL REFERENCES game_dlc(id) ON DELETE CASCADE,
    PRIMARY KEY (dlc_id, required_dlc_id)
);

-- Сезонные пропуска
CREATE TABLE season_passes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    original_price DECIMAL(10,2) NOT NULL,
    duration_months INTEGER NOT NULL,
    savings_percentage INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- DLC включенные в сезонный пропуск
CREATE TABLE season_pass_dlc (
    season_pass_id UUID NOT NULL REFERENCES season_passes(id) ON DELETE CASCADE,
    dlc_id UUID NOT NULL REFERENCES game_dlc(id) ON DELETE CASCADE,
    is_released BOOLEAN DEFAULT FALSE,
    estimated_release_date DATE,
    PRIMARY KEY (season_pass_id, dlc_id)
);

-- Бандлы
CREATE TABLE game_bundles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    bundle_type VARCHAR(20) NOT NULL CHECK (bundle_type IN ('publisher', 'franchise', 'genre', 'themed', 'seasonal', 'charity', 'humble')),
    total_price DECIMAL(10,2) NOT NULL,
    discounted_price DECIMAL(10,2) NOT NULL,
    discount_percentage INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    purchase_count BIGINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Игры в бандле
CREATE TABLE bundle_games (
    bundle_id UUID NOT NULL REFERENCES game_bundles(id) ON DELETE CASCADE,
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    individual_price DECIMAL(10,2) NOT NULL,
    sort_order INTEGER DEFAULT 0,
    PRIMARY KEY (bundle_id, game_id)
);

-- Франшизы
CREATE TABLE franchises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    logo_url VARCHAR(500),
    total_sales BIGINT DEFAULT 0,
    average_rating DECIMAL(3,2) DEFAULT 0,
    games_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Игры во франшизе
CREATE TABLE franchise_games (
    franchise_id UUID NOT NULL REFERENCES franchises(id) ON DELETE CASCADE,
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    order_in_series INTEGER NOT NULL,
    is_main_series BOOLEAN DEFAULT TRUE,
    is_remaster BOOLEAN DEFAULT FALSE,
    original_game_id UUID REFERENCES games(id),
    PRIMARY KEY (franchise_id, game_id)
);

-- Greenlight система
CREATE TABLE greenlight_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    submission_date TIMESTAMP DEFAULT NOW(),
    approval_date TIMESTAMP,
    votes_for INTEGER DEFAULT 0,
    votes_against INTEGER DEFAULT 0,
    total_votes INTEGER DEFAULT 0,
    approval_threshold INTEGER DEFAULT 1000,
    status VARCHAR(20) DEFAULT 'submitted' CHECK (status IN ('submitted', 'in_voting', 'approved', 'rejected')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Голоса Greenlight
CREATE TABLE greenlight_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES greenlight_submissions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    vote VARCHAR(10) NOT NULL CHECK (vote IN ('for', 'against')),
    comment TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(submission_id, user_id)
);

-- Игровые ключи (интеграция)
CREATE TABLE game_key_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    batch_name VARCHAR(255) NOT NULL,
    key_count INTEGER NOT NULL,
    keys_activated INTEGER DEFAULT 0,
    batch_type VARCHAR(20) NOT NULL CHECK (batch_type IN ('retail', 'promotional', 'developer', 'press')),
    created_by UUID NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Индексы для новых таблиц
CREATE INDEX idx_game_preorders_game ON game_preorders(game_id);
CREATE INDEX idx_game_preorders_dates ON game_preorders(start_date, release_date);
CREATE INDEX idx_preorder_tiers_preorder ON preorder_tiers(preorder_id, sort_order);
CREATE INDEX idx_game_demos_game ON game_demos(game_id);
CREATE INDEX idx_game_demos_available ON game_demos(is_available) WHERE is_available = TRUE;
CREATE INDEX idx_game_editions_game ON game_editions(game_id, sort_order);
CREATE INDEX idx_game_dlc_game ON game_dlc(game_id);
CREATE INDEX idx_game_dlc_type ON game_dlc(dlc_type);
CREATE INDEX idx_season_passes_game ON season_passes(game_id);
CREATE INDEX idx_game_bundles_active ON game_bundles(is_active, end_date) WHERE is_active = TRUE;
CREATE INDEX idx_bundle_games_bundle ON bundle_games(bundle_id, sort_order);
CREATE INDEX idx_franchises_name ON franchises(name);
CREATE INDEX idx_franchise_games_franchise ON franchise_games(franchise_id, order_in_series);
CREATE INDEX idx_greenlight_status ON greenlight_submissions(status);
CREATE INDEX idx_greenlight_votes_submission ON greenlight_votes(submission_id);
CREATE INDEX idx_game_key_batches_game ON game_key_batches(game_id);

```