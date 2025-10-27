# Примеры интеграции User Service с микросервисами

## Обзор

Данный документ содержит практические примеры интеграции User Service с другими микросервисами платформы. Все примеры основаны на реальных сценариях использования и оптимизированы для высокой производительности.

## Содержание

1. [Auth Service - Аутентификация и управление сессиями](#auth-service)
2. [Game Catalog Service - Персонализация игрового каталога](#game-catalog-service)
3. [Payment Service - Обработка платежей](#payment-service)
4. [Library Service - Управление игровой библиотекой](#library-service)
5. [Social Service - Социальные функции](#social-service)
6. [Achievement Service - Система достижений](#achievement-service)
7. [Notification Service - Уведомления](#notification-service)
8. [Security Service - Аудит и безопасность](#security-service)

---

## Auth Service

### Сценарий 1: Регистрация нового пользователя

**Последовательность действий:**
1. Auth Service получает данные регистрации
2. Auth Service хеширует пароль
3. Auth Service создает пользователя в User Service
4. User Service возвращает данные созданного пользователя
5. Auth Service генерирует JWT токен

**Код в Auth Service:**
```typescript
// auth-service/src/auth.service.ts
@Injectable()
export class AuthService {
  constructor(
    private readonly userClient: UserClientService,
    private readonly jwtService: JwtService,
    private readonly bcrypt: BcryptService
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    // 1. Хешируем пароль
    const hashedPassword = await this.bcrypt.hash(registerDto.password, 10);

    // 2. Создаем пользователя в User Service
    const user = await this.userClient.createUser({
      name: registerDto.name,
      email: registerDto.email,
      password: hashedPassword
    });

    // 3. Генерируем JWT токен
    const tokens = await this.generateTokens(user);

    // 4. Логируем событие регистрации
    await this.auditService.logEvent({
      type: 'USER_REGISTERED',
      userId: user.id,
      email: user.email,
      timestamp: new Date()
    });

    return {
      user: this.sanitizeUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    };
  }
}
```

**API вызов к User Service:**
```bash
curl -X POST http://user-service:3001/api/internal/users \
  -H "Authorization: Bearer auth-service-key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Иван Петров",
    "email": "ivan.petrov@example.com",
    "password": "$2b$10$N9qo8uLOickgx2ZMRZoMye.IjdBHGnqeJf7rMF.IjdBHGnqeJf7rMF"
  }'
```

### Сценарий 2: Аутентификация пользователя

**Код в Auth Service:**
```typescript
async login(loginDto: LoginDto): Promise<AuthResponse> {
  // 1. Получаем пользователя по email
  const user = await this.userClient.findByEmail(loginDto.email);
  
  if (!user) {
    throw new UnauthorizedException('Неверные учетные данные');
  }

  // 2. Проверяем пароль
  const isPasswordValid = await this.bcrypt.compare(
    loginDto.password, 
    user.password
  );

  if (!isPasswordValid) {
    throw new UnauthorizedException('Неверные учетные данные');
  }

  // 3. Обновляем время последнего входа
  await this.userClient.updateLastLogin(user.id, {
    lastLoginAt: new Date(),
    ipAddress: this.getClientIp(),
    userAgent: this.getUserAgent()
  });

  // 4. Генерируем токены
  const tokens = await this.generateTokens(user);

  return {
    user: this.sanitizeUser(user),
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken
  };
}
```

### Сценарий 3: Batch обновление активности пользователей

**Код для массового обновления lastLoginAt:**
```typescript
// auth-service/src/session.service.ts
@Injectable()
export class SessionService {
  async updateBatchLastLogin(sessions: ActiveSession[]): Promise<void> {
    const updates = sessions.map(session => ({
      userId: session.userId,
      lastLoginAt: session.lastActivity,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent
    }));

    await this.userClient.batchUpdateLastLogin(updates);
  }
}
```

**API вызов:**
```bash
curl -X PATCH http://user-service:3001/api/batch/users/last-login \
  -H "Authorization: Bearer auth-service-key" \
  -H "Content-Type: application/json" \
  -d '{
    "updates": [
      {
        "userId": "550e8400-e29b-41d4-a716-446655440001",
        "lastLoginAt": "2024-01-15T12:00:00.000Z",
        "ipAddress": "192.168.1.100"
      }
    ]
  }'
```

---

## Game Catalog Service

### Сценарий 1: Персонализация каталога игр

**Код в Game Catalog Service:**
```typescript
// game-catalog-service/src/personalization.service.ts
@Injectable()
export class PersonalizationService {
  constructor(
    private readonly userClient: UserClientService,
    private readonly gameService: GameService
  ) {}

  async getPersonalizedCatalog(userId: string): Promise<PersonalizedCatalog> {
    // 1. Получаем профиль пользователя с предпочтениями
    const userProfile = await this.userClient.getUserProfile(userId, {
      includePreferences: true,
      includePrivacySettings: true
    });

    if (!userProfile) {
      throw new NotFoundException('Пользователь не найден');
    }

    // 2. Извлекаем игровые предпочтения
    const gameSettings = userProfile.preferences?.gameSettings || {};
    const preferredGenres = gameSettings.preferredGenres || [];
    const language = userProfile.preferences?.language || 'ru';

    // 3. Получаем персонализированные рекомендации
    const recommendations = await this.gameService.getRecommendations({
      userId,
      genres: preferredGenres,
      language,
      excludeOwned: true,
      limit: 20
    });

    // 4. Фильтруем по настройкам приватности
    const filteredGames = this.filterByPrivacySettings(
      recommendations,
      userProfile.privacySettings
    );

    return {
      userId,
      recommendations: filteredGames,
      personalizedBy: {
        genres: preferredGenres,
        language,
        privacyLevel: userProfile.privacySettings?.profileVisibility
      }
    };
  }
}
```

**API вызов к User Service:**
```bash
curl "http://user-service:3001/api/internal/users/550e8400-e29b-41d4-a716-446655440001/profile?includePreferences=true&includePrivacySettings=true" \
  -H "x-api-key: game-catalog-key"
```

### Сценарий 2: Batch получение профилей для социальных функций

**Код для отображения друзей в каталоге:**
```typescript
async getFriendsGameActivity(userId: string): Promise<FriendsActivity[]> {
  // 1. Получаем список друзей из Social Service
  const friends = await this.socialClient.getFriends(userId);
  const friendIds = friends.map(f => f.id);

  // 2. Batch получение профилей друзей
  const friendProfiles = await this.userClient.getBatchProfiles(friendIds, {
    fields: ['name', 'avatarUrl', 'preferences.gameSettings', 'privacySettings'],
    includePrivacySettings: true
  });

  // 3. Фильтруем по настройкам приватности
  const visibleFriends = friendProfiles.filter(profile => 
    profile.privacySettings?.showGameActivity !== false
  );

  // 4. Получаем игровую активность
  const activities = await Promise.all(
    visibleFriends.map(async (friend) => {
      const recentGames = await this.gameActivityService.getRecentGames(friend.id);
      return {
        user: {
          id: friend.id,
          name: friend.name,
          avatarUrl: friend.avatarUrl
        },
        recentGames,
        isOnline: await this.presenceService.isOnline(friend.id)
      };
    })
  );

  return activities;
}
```

**API вызов:**
```bash
curl -X POST http://user-service:3001/api/internal/users/batch/profiles \
  -H "x-api-key: game-catalog-key" \
  -H "Content-Type: application/json" \
  -d '{
    "userIds": ["uuid1", "uuid2", "uuid3"],
    "includePreferences": true,
    "fields": ["name", "avatarUrl", "preferences.gameSettings", "privacySettings.showGameActivity"]
  }'
```

---

## Payment Service

### Сценарий 1: Обработка покупки игры

**Код в Payment Service:**
```typescript
// payment-service/src/purchase.service.ts
@Injectable()
export class PurchaseService {
  async processPurchase(purchaseDto: PurchaseDto): Promise<PurchaseResult> {
    // 1. Получаем биллинговую информацию пользователя
    const billingInfo = await this.userClient.getBillingInfo(purchaseDto.userId);
    
    if (!billingInfo) {
      throw new BadRequestException('Биллинговая информация не настроена');
    }

    // 2. Валидируем платежные данные
    const paymentData = {
      ...purchaseDto,
      currency: billingInfo.currency || 'RUB',
      taxRate: this.getTaxRate(billingInfo.country),
      billingAddress: billingInfo.address
    };

    // 3. Обрабатываем платеж
    const paymentResult = await this.paymentProcessor.process(paymentData);

    if (paymentResult.success) {
      // 4. Обновляем статистику покупок пользователя
      await this.userClient.updateBillingStats(purchaseDto.userId, {
        lastPurchaseAt: new Date(),
        totalSpent: paymentResult.amount,
        purchaseCount: 1
      });

      // 5. Уведомляем Library Service о покупке
      await this.libraryClient.addGameToLibrary({
        userId: purchaseDto.userId,
        gameId: purchaseDto.gameId,
        purchaseId: paymentResult.transactionId
      });
    }

    return paymentResult;
  }
}
```

**API вызов для получения биллинговой информации:**
```bash
curl "http://user-service:3001/api/internal/users/550e8400-e29b-41d4-a716-446655440001/billing-info" \
  -H "x-api-key: payment-service-key"
```

**Ответ:**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440001",
  "currency": "RUB",
  "country": "RU",
  "address": {
    "street": "ул. Примерная, 123",
    "city": "Москва",
    "postalCode": "123456",
    "country": "RU"
  },
  "paymentMethods": ["card", "qiwi", "yandex_money"],
  "taxId": "123456789012",
  "statistics": {
    "totalSpent": 15420.50,
    "purchaseCount": 23,
    "lastPurchaseAt": "2024-01-10T14:30:00.000Z"
  }
}
```

### Сценарий 2: Обновление биллинговой информации

**API вызов для обновления:**
```bash
curl -X PATCH http://user-service:3001/api/internal/users/550e8400-e29b-41d4-a716-446655440001/billing-info \
  -H "x-api-key: payment-service-key" \
  -H "Content-Type: application/json" \
  -d '{
    "address": {
      "street": "ул. Новая, 456",
      "city": "Санкт-Петербург",
      "postalCode": "654321",
      "country": "RU"
    },
    "paymentMethods": ["card", "sbp"],
    "currency": "RUB"
  }'
```

---

## Library Service

### Сценарий 1: Синхронизация игровых предпочтений

**Код в Library Service:**
```typescript
// library-service/src/preferences.service.ts
@Injectable()
export class PreferencesService {
  async syncGamePreferences(userId: string, gameId: string): Promise<void> {
    // 1. Получаем текущие предпочтения пользователя
    const userPreferences = await this.userClient.getUserPreferences(userId);
    
    // 2. Получаем информацию об игре
    const gameInfo = await this.gameService.getGameInfo(gameId);
    
    // 3. Обновляем предпочтения на основе игровой активности
    const updatedPreferences = {
      ...userPreferences,
      gameSettings: {
        ...userPreferences.gameSettings,
        preferredGenres: this.updatePreferredGenres(
          userPreferences.gameSettings?.preferredGenres || [],
          gameInfo.genres
        ),
        lastPlayedGenre: gameInfo.primaryGenre,
        autoDownload: userPreferences.gameSettings?.autoDownload ?? true
      }
    };

    // 4. Сохраняем обновленные предпочтения
    await this.userClient.updateUserPreferences(userId, updatedPreferences);
  }

  private updatePreferredGenres(current: string[], gameGenres: string[]): string[] {
    const updated = [...current];
    
    gameGenres.forEach(genre => {
      if (!updated.includes(genre)) {
        updated.push(genre);
      }
    });

    // Ограничиваем до 10 жанров
    return updated.slice(-10);
  }
}
```

**API вызов для получения предпочтений:**
```bash
curl "http://user-service:3001/api/internal/users/550e8400-e29b-41d4-a716-446655440001/preferences" \
  -H "x-api-key: library-service-key"
```

**Ответ:**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440001",
  "preferences": {
    "language": "ru",
    "timezone": "Europe/Moscow",
    "theme": "dark",
    "notifications": {
      "email": true,
      "push": true,
      "sms": false
    },
    "gameSettings": {
      "autoDownload": true,
      "cloudSave": true,
      "achievementNotifications": true,
      "preferredGenres": ["action", "rpg", "strategy"],
      "downloadPath": "/games",
      "maxConcurrentDownloads": 3,
      "autoUpdate": true,
      "lastPlayedGenre": "rpg"
    }
  }
}
```

### Сценарий 2: Event-driven обновление при изменении предпочтений

**Обработчик событий в Library Service:**
```typescript
// library-service/src/events/user-events.handler.ts
@Injectable()
export class UserEventsHandler {
  @EventPattern('user.preferences.changed')
  async handlePreferencesChanged(event: UserPreferencesChangedEvent): Promise<void> {
    const { userId, changes, newPreferences } = event.data;

    // Проверяем, изменились ли игровые настройки
    const gameSettingsChanged = changes.some(change => 
      change.startsWith('gameSettings')
    );

    if (gameSettingsChanged) {
      // Синхронизируем настройки загрузки
      await this.downloadService.updateDownloadSettings(userId, {
        autoDownload: newPreferences.gameSettings?.autoDownload,
        maxConcurrentDownloads: newPreferences.gameSettings?.maxConcurrentDownloads,
        downloadPath: newPreferences.gameSettings?.downloadPath
      });

      // Обновляем рекомендации игр
      await this.recommendationService.refreshRecommendations(userId);
    }

    // Проверяем изменения языка
    if (changes.includes('language')) {
      await this.localizationService.updateUserLanguage(
        userId, 
        newPreferences.language
      );
    }
  }
}
```

---

## Social Service

### Сценарий 1: Получение публичных профилей для поиска друзей

**Код в Social Service:**
```typescript
// social-service/src/friends.service.ts
@Injectable()
export class FriendsService {
  async searchUsers(query: string, requesterId: string): Promise<UserSearchResult[]> {
    // 1. Ищем пользователей по имени/email
    const users = await this.userClient.searchUsers({
      query,
      limit: 20,
      excludeIds: [requesterId]
    });

    // 2. Получаем детальную информацию о найденных пользователях
    const userIds = users.map(u => u.id);
    const profiles = await this.userClient.getBatchProfiles(userIds, {
      fields: ['name', 'avatarUrl', 'privacySettings'],
      publicOnly: true
    });

    // 3. Фильтруем по настройкам приватности
    const visibleProfiles = profiles.filter(profile => 
      profile.privacySettings?.profileVisibility !== 'private'
    );

    // 4. Проверяем статус дружбы
    const results = await Promise.all(
      visibleProfiles.map(async (profile) => {
        const friendshipStatus = await this.getFriendshipStatus(
          requesterId, 
          profile.id
        );

        return {
          id: profile.id,
          name: profile.name,
          avatarUrl: profile.avatarUrl,
          friendshipStatus,
          canSendRequest: profile.privacySettings?.allowFriendRequests !== false
        };
      })
    );

    return results;
  }
}
```

**API вызов для поиска пользователей:**
```bash
curl "http://user-service:3001/api/batch/users/lookup?query=Иван&fields=name,avatarUrl,privacySettings&publicOnly=true" \
  -H "x-api-key: social-service-key"
```

### Сценарий 2: Получение настроек приватности

**API вызов:**
```bash
curl "http://user-service:3001/api/internal/users/550e8400-e29b-41d4-a716-446655440001/privacy-settings" \
  -H "x-api-key: social-service-key"
```

**Ответ:**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440001",
  "privacySettings": {
    "profileVisibility": "public",
    "showOnlineStatus": true,
    "showGameActivity": true,
    "allowFriendRequests": true,
    "showAchievements": true,
    "showLibrary": false,
    "showRecentActivity": true
  }
}
```

---

## Achievement Service

### Сценарий 1: Проверка настроек уведомлений о достижениях

**Код в Achievement Service:**
```typescript
// achievement-service/src/notification.service.ts
@Injectable()
export class AchievementNotificationService {
  async notifyAchievementUnlocked(
    userId: string, 
    achievementId: string
  ): Promise<void> {
    // 1. Получаем настройки уведомлений пользователя
    const userSettings = await this.userClient.getAchievementSettings(userId);
    
    if (!userSettings?.achievementNotifications) {
      return; // Пользователь отключил уведомления о достижениях
    }

    // 2. Получаем информацию о достижении
    const achievement = await this.achievementRepository.findById(achievementId);
    
    // 3. Отправляем уведомление согласно предпочтениям
    const notificationPrefs = userSettings.notifications || {};
    
    if (notificationPrefs.push) {
      await this.pushNotificationService.send(userId, {
        title: 'Достижение разблокировано!',
        body: `Вы получили достижение: ${achievement.name}`,
        data: { achievementId, type: 'achievement_unlocked' }
      });
    }

    if (notificationPrefs.email) {
      await this.emailService.sendAchievementNotification(userId, achievement);
    }
  }
}
```

**API вызов для получения настроек достижений:**
```bash
curl "http://user-service:3001/api/internal/users/550e8400-e29b-41d4-a716-446655440001/achievements-settings" \
  -H "x-api-key: achievement-service-key"
```

**Ответ:**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440001",
  "achievementNotifications": true,
  "notifications": {
    "push": true,
    "email": false,
    "sms": false
  },
  "achievementSettings": {
    "showProgress": true,
    "showToFriends": true,
    "autoShare": false,
    "difficultyPreference": "normal"
  }
}
```

---

## Notification Service

### Сценарий 1: Обработка событий изменения пользователя

**Event handler в Notification Service:**
```typescript
// notification-service/src/events/user-events.handler.ts
@Injectable()
export class UserEventsHandler {
  @EventPattern('user.created')
  async handleUserCreated(event: UserCreatedEvent): Promise<void> {
    const { userId, email, name } = event.data;

    // Отправляем приветственное письмо
    await this.emailService.sendWelcomeEmail({
      to: email,
      name,
      userId,
      templateData: {
        activationLink: this.generateActivationLink(userId),
        supportEmail: 'support@gameplatform.ru'
      }
    });

    // Создаем настройки уведомлений по умолчанию
    await this.notificationPreferencesService.createDefault(userId);
  }

  @EventPattern('user.profile.updated')
  async handleProfileUpdated(event: UserProfileUpdatedEvent): Promise<void> {
    const { userId, changes } = event.data;

    // Если изменился email, отправляем подтверждение
    if (changes.includes('email')) {
      const user = await this.userClient.getUser(userId);
      await this.emailService.sendEmailVerification(user.email, userId);
    }

    // Если изменились настройки уведомлений
    if (changes.some(change => change.startsWith('notifications'))) {
      await this.notificationPreferencesService.sync(userId);
    }
  }
}
```

---

## Security Service

### Сценарий 1: Аудит операций с пользовательскими данными

**Код в Security Service для обработки аудит событий:**
```typescript
// security-service/src/audit.service.ts
@Injectable()
export class AuditService {
  @EventPattern('user.data.accessed')
  async handleDataAccess(event: DataAccessEvent): Promise<void> {
    const auditEntry = {
      timestamp: event.timestamp,
      userId: event.userId,
      operation: event.operation,
      resourceId: event.resourceId,
      requestedBy: event.requestedBy,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      correlationId: event.correlationId,
      dataFields: event.dataFields,
      success: event.success
    };

    // Сохраняем в аудит лог
    await this.auditRepository.save(auditEntry);

    // Проверяем на подозрительную активность
    await this.suspiciousActivityDetector.analyze(auditEntry);
  }

  @EventPattern('user.batch.operation')
  async handleBatchOperation(event: BatchOperationEvent): Promise<void> {
    const { operation, recordCount, processingTime, requestedBy } = event.data;

    // Логируем массовые операции
    await this.auditRepository.save({
      type: 'BATCH_OPERATION',
      operation,
      recordCount,
      processingTime,
      requestedBy,
      timestamp: new Date(),
      correlationId: event.correlationId
    });

    // Проверяем на аномальные массовые операции
    if (recordCount > 1000 || processingTime > 10000) {
      await this.alertService.sendAlert({
        type: 'LARGE_BATCH_OPERATION',
        details: { operation, recordCount, processingTime, requestedBy }
      });
    }
  }
}
```

### Сценарий 2: Мониторинг безопасности интеграций

**Код для мониторинга API вызовов:**
```typescript
// security-service/src/integration-monitor.service.ts
@Injectable()
export class IntegrationMonitorService {
  async monitorApiCall(callData: ApiCallData): Promise<void> {
    const securityCheck = {
      timestamp: new Date(),
      service: callData.service,
      endpoint: callData.endpoint,
      method: callData.method,
      responseTime: callData.responseTime,
      statusCode: callData.statusCode,
      apiKey: this.hashApiKey(callData.apiKey),
      ipAddress: callData.ipAddress,
      recordsAccessed: callData.recordsAccessed
    };

    // Проверяем rate limiting
    const rateLimitStatus = await this.rateLimitChecker.check(
      callData.service,
      callData.ipAddress
    );

    if (rateLimitStatus.exceeded) {
      await this.alertService.sendAlert({
        type: 'RATE_LIMIT_EXCEEDED',
        service: callData.service,
        ipAddress: callData.ipAddress,
        currentRate: rateLimitStatus.currentRate,
        limit: rateLimitStatus.limit
      });
    }

    // Проверяем аномальные паттерны доступа
    await this.anomalyDetector.analyze(securityCheck);
  }
}
```

---

## Event-Driven интеграция

### Публикация событий из User Service

**Код в User Service для публикации событий:**
```typescript
// user-service/src/integration/event-publisher.service.ts
@Injectable()
export class EventPublisherService {
  constructor(
    @Inject('MESSAGE_QUEUE') private readonly messageQueue: ClientProxy
  ) {}

  async publishUserCreated(user: User): Promise<void> {
    const event: UserCreatedEvent = {
      type: 'USER_CREATED',
      userId: user.id,
      timestamp: new Date(),
      data: {
        userId: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt
      },
      correlationId: this.generateCorrelationId(),
      source: 'user-service'
    };

    await this.messageQueue.emit('user.created', event);
  }

  async publishPreferencesChanged(
    userId: string, 
    changes: string[], 
    previousValues: any, 
    newValues: any
  ): Promise<void> {
    const event: UserPreferencesChangedEvent = {
      type: 'PREFERENCES_CHANGED',
      userId,
      timestamp: new Date(),
      data: {
        userId,
        changes,
        previous: previousValues,
        current: newValues
      },
      correlationId: this.generateCorrelationId(),
      source: 'user-service'
    };

    await this.messageQueue.emit('user.preferences.changed', event);
  }
}
```

### Подписка на события в других сервисах

**Пример подписки в Library Service:**
```typescript
// library-service/src/events/user-events.subscriber.ts
@Controller()
export class UserEventsSubscriber {
  @EventPattern('user.preferences.changed')
  async handlePreferencesChanged(event: UserPreferencesChangedEvent): Promise<void> {
    const { userId, changes, current } = event.data;

    // Обрабатываем изменения игровых настроек
    if (changes.some(change => change.startsWith('gameSettings'))) {
      await this.gameSettingsService.sync(userId, current.gameSettings);
    }

    // Обрабатываем изменения языка
    if (changes.includes('language')) {
      await this.localizationService.updateLanguage(userId, current.language);
    }
  }

  @EventPattern('user.deleted')
  async handleUserDeleted(event: UserDeletedEvent): Promise<void> {
    const { userId } = event.data;

    // Удаляем библиотеку пользователя
    await this.libraryService.deleteUserLibrary(userId);
    
    // Удаляем загрузки
    await this.downloadService.cancelAllDownloads(userId);
  }
}
```

## Заключение

Интеграция User Service с другими микросервисами обеспечивает:

- **Высокую производительность** через оптимизированные API и кэширование
- **Безопасность** через API ключи, аудит и мониторинг
- **Надежность** через event-driven архитектуру и graceful degradation
- **Масштабируемость** через batch операции и асинхронную обработку
- **Консистентность данных** через транзакционные операции и компенсирующие действия

Все интеграции спроектированы для работы в высоконагруженной среде с автоматическим восстановлением при сбоях.