# Auth Service - Troubleshooting Guide

## Критические проблемы архитектуры и бизнес-логики

Данный документ содержит анализ критических проблем, выявленных в архитектуре Auth Service, и рекомендации по их устранению.

---

## 🔴 КРИТИЧЕСКИЕ ПРОБЛЕМЫ БЕЗОПАСНОСТИ

### 1. Race Condition в управлении сессиями

**Местоположение**: `src/auth/auth.service.ts:158-170`

```typescript
// Проблемный код
const removedSessionsCount = await this.sessionService.enforceSessionLimit(user.id, this.maxSessionsPerUser);
// ... другие операции ...
const session = await this.sessionService.createSession({...});
```

**Проблема**: Между проверкой лимита сессий и созданием новой сессии может произойти race condition, если пользователь одновременно логинится с нескольких устройств. Это может привести к превышению лимита сессий.

**Критичность**: 🔴 Высокая

**Последствия**:
- Превышение лимита активных сессий
- Потенциальная DoS атака через создание множественных сессий
- Нарушение бизнес-логики ограничений

**Решение**:
```typescript
// Использовать распределенную блокировку
const lockKey = `session_limit:${user.id}`;
await this.redisService.acquireLock(lockKey, 5000); // 5 секунд
try {
  const removedSessionsCount = await this.sessionService.enforceSessionLimit(user.id, this.maxSessionsPerUser);
  const session = await this.sessionService.createSession({...});
  return session;
} finally {
  await this.redisService.releaseLock(lockKey);
}
```

---

### 2. Хранение токенов в открытом виде в базе данных

**Местоположение**: `src/entities/session.entity.ts:20-24`

```typescript
// Проблемный код
@Column({ type: 'text' })
accessToken: string;

@Column({ type: 'text' })
refreshToken: string;
```

**Проблема**: Access и refresh токены хранятся в открытом виде в базе данных. При компрометации БД злоумышленник получит доступ ко всем активным токенам.

**Критичность**: 🔴 Высокая

**Последствия**:
- Полная компрометация всех пользовательских сессий при утечке БД
- Невозможность отозвать скомпрометированные токены
- Нарушение принципов безопасности хранения данных

**Решение**:
```typescript
// Хранить хеши токенов вместо самих токенов
@Column({ type: 'varchar', length: 64 })
accessTokenHash: string;

@Column({ type: 'varchar', length: 64 })
refreshTokenHash: string;

// В сервисе
private hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
```

---

### 3. Отсутствие атомарности в операциях logout

**Местоположение**: `src/auth/auth.service.ts:240-255`

```typescript
// Проблемный код
const session = await this.sessionService.getSessionByAccessToken(accessToken);
if (session) {
  await this.sessionService.invalidateSession(session.id);
}
await this.tokenService.blacklistToken(accessToken, userId, 'logout');
```

**Проблема**: Если операция blacklistToken завершится ошибкой после invalidateSession, токен останется активным, но сессия будет недействительна.

**Критичность**: 🔴 Высокая

**Последствия**:
- Неконсистентное состояние между сессиями и токенами
- Возможность использования "мертвых" токенов
- Сложность отладки проблем аутентификации

**Решение**:
```typescript
// Использовать транзакции или компенсирующие действия
const session = await this.sessionService.getSessionByAccessToken(accessToken);
if (session) {
  try {
    await this.tokenService.blacklistToken(accessToken, userId, 'logout');
    await this.sessionService.invalidateSession(session.id);
  } catch (error) {
    // Компенсирующее действие - восстановить токен если сессия была инвалидирована
    await this.tokenService.removeFromBlacklist(accessToken);
    throw error;
  }
}
```

---

### 4. Уязвимость к JWT Token Fixation

**Местоположение**: `src/token/token.service.ts:280-295`

```typescript
// Проблемный код
const newTokens = await this.generateTokens({...});
await this.blacklistToken(refreshToken, userId, 'refresh', {...});
```

**Проблема**: Новые токены генерируются до блокировки старого refresh токена. Если процесс прервется, старый токен останется активным вместе с новым.

**Критичность**: 🔴 Высокая

**Последствия**:
- Возможность использования старого и нового refresh токена одновременно
- Нарушение принципа ротации токенов
- Потенциальная возможность replay атак

**Решение**:
```typescript
// Сначала блокировать старый токен, затем генерировать новый
await this.blacklistToken(refreshToken, userId, 'refresh', {...});
try {
  const newTokens = await this.generateTokens({...});
  return newTokens;
} catch (error) {
  // Компенсирующее действие - восстановить старый токен
  await this.removeFromBlacklist(refreshToken);
  throw error;
}
```

---

## 🟡 КРИТИЧЕСКИЕ ПРОБЛЕМЫ АРХИТЕКТУРЫ

### 5. Отсутствие транзакций в критических операциях

**Местоположение**: `src/auth/auth.service.ts:75-125`

```typescript
// Проблемный код
const newUser = await this.userServiceClient.createUser({...});
const tokens = await this.generateTokens(newUser);
const session = await this.sessionService.createSession({...});
```

**Проблема**: Если создание сессии завершится ошибкой, пользователь будет создан, но не сможет войти в систему.

**Критичность**: 🟡 Средняя

**Последствия**:
- Неконсистентное состояние данных
- "Зависшие" пользователи без возможности входа
- Сложность восстановления после ошибок

**Решение**:
```typescript
// Использовать Saga pattern или компенсирующие транзакции
const sagaId = generateSagaId();
try {
  const newUser = await this.userServiceClient.createUser({...}, sagaId);
  const tokens = await this.generateTokens(newUser);
  const session = await this.sessionService.createSession({...});
  await this.sagaService.complete(sagaId);
  return result;
} catch (error) {
  await this.sagaService.compensate(sagaId);
  throw error;
}
```

---

### 6. Неконсистентное управление состоянием токенов

**Местоположение**: `src/token/token.service.ts:85-95`

```typescript
// Проблемный код
await this.authDatabaseService.blacklistToken(...);
await this.redisService.blacklistToken(token, ttl);
```

**Проблема**: Нет гарантии консистентности между Redis и PostgreSQL. Токен может быть заблокирован в одном хранилище, но не в другом.

**Критичность**: 🟡 Средняя

**Последствия**:
- Неконсистентное состояние между кэшем и БД
- Возможность обхода блокировки токенов
- Сложность отладки проблем с токенами

**Решение**:
```typescript
// Использовать двухфазный коммит или eventual consistency
async blacklistToken(token: string, userId: string, reason: string) {
  const transaction = await this.startDistributedTransaction();
  try {
    await this.authDatabaseService.blacklistToken(..., transaction);
    await this.redisService.blacklistToken(token, ttl, transaction);
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
```

---

### 7. Отсутствие идемпотентности в критических операциях

**Местоположение**: Все основные методы AuthService

**Проблема**: Операции регистрации, логина и logout не являются идемпотентными, что может привести к дублированию данных или неконсистентному состоянию при повторных запросах.

**Критичность**: 🟡 Средняя

**Последствия**:
- Дублирование операций при повторных запросах
- Неконсистентное состояние при сетевых сбоях
- Сложность обработки ошибок на клиенте

**Решение**:
```typescript
// Добавить идемпотентные ключи
async register(registerDto: RegisterDto, idempotencyKey: string) {
  const existingOperation = await this.getOperation(idempotencyKey);
  if (existingOperation) {
    return existingOperation.result;
  }
  
  const result = await this.performRegistration(registerDto);
  await this.saveOperation(idempotencyKey, result);
  return result;
}
```

---

## 🟠 ПРОБЛЕМЫ ПРОИЗВОДИТЕЛЬНОСТИ И НАДЕЖНОСТИ

### 8. Потенциальная утечка памяти в кэше

**Местоположение**: `src/common/http-client/user-service.client.ts:35`

```typescript
// Проблемный код
private readonly userCache = new Map<string, { user: User | null; timestamp: number }>();
```

**Проблема**: Кэш не имеет ограничений по размеру и может расти бесконечно.

**Критичность**: 🟠 Низкая

**Последствия**:
- Утечка памяти при большом количестве пользователей
- Деградация производительности
- Возможный OutOfMemory

**Решение**:
```typescript
// Использовать LRU кэш с ограничениями
private readonly userCache = new LRUCache<string, CacheEntry>({
  max: 10000, // максимум 10k записей
  ttl: 5 * 60 * 1000, // 5 минут TTL
});
```

---

### 9. Блокирующие операции в критическом пути

**Местоположение**: `src/auth/auth.service.ts:110`

```typescript
// Проблемный код
void this.eventBusService.publishUserRegisteredEvent(...);
```

**Проблема**: Хотя используется `void`, внутри publishUserRegisteredEvent могут быть блокирующие операции.

**Критичность**: 🟠 Низкая

**Последствия**:
- Замедление критических операций
- Возможные таймауты
- Плохой пользовательский опыт

**Решение**:
```typescript
// Использовать настоящую асинхронную обработку
setImmediate(() => {
  this.eventBusService.publishUserRegisteredEvent(...);
});
```

---

### 10. Отсутствие graceful degradation

**Местоположение**: Все HTTP клиенты

**Проблема**: При недоступности внешних сервисов (User Service, Security Service) система может полностью отказать в обслуживании вместо деградации функциональности.

**Критичность**: 🟠 Низкая

**Последствия**:
- Полный отказ сервиса при недоступности зависимостей
- Плохая отказоустойчивость
- Каскадные сбои

**Решение**:
```typescript
// Реализовать fallback механизмы
async findByEmail(email: string): Promise<User | null> {
  try {
    return await this.userServiceClient.findByEmail(email);
  } catch (error) {
    if (this.isServiceUnavailable(error)) {
      // Fallback к локальному кэшу или упрощенной логике
      return this.fallbackUserLookup(email);
    }
    throw error;
  }
}
```

---

## 🔧 ПЛАН ИСПРАВЛЕНИЯ

### Приоритет 1 (Критический) - Исправить немедленно
1. ✅ Реализовать хеширование токенов в БД
2. ✅ Добавить распределенные блокировки для сессий
3. ✅ Исправить атомарность операций logout
4. ✅ Устранить уязвимость Token Fixation

### Приоритет 2 (Высокий) - Исправить в течение недели
5. ⏳ Внедрить транзакционность в критических операциях
6. ⏳ Обеспечить консистентность Redis/PostgreSQL
7. ⏳ Добавить идемпотентность операций

### Приоритет 3 (Средний) - Исправить в течение месяца
8. ⏳ Ограничить размер кэшей
9. ⏳ Оптимизировать асинхронные операции
10. ⏳ Реализовать graceful degradation

---

## 📊 МЕТРИКИ ДЛЯ МОНИТОРИНГА

После исправления проблем необходимо внедрить следующие метрики:

- **Консистентность токенов**: Процент совпадений между Redis и PostgreSQL
- **Race conditions**: Количество конфликтов при создании сессий
- **Время отклика**: Латентность критических операций
- **Ошибки транзакций**: Количество откатов и компенсаций
- **Размер кэшей**: Использование памяти кэшами
- **Доступность сервисов**: Uptime внешних зависимостей

---

## 🚨 ЭКСТРЕННЫЕ ПРОЦЕДУРЫ

### При обнаружении компрометации токенов:
1. Немедленно инвалидировать все сессии пользователя
2. Принудительно разлогинить пользователя со всех устройств
3. Заблокировать все токены пользователя в Redis и БД
4. Уведомить пользователя о подозрительной активности

### При обнаружении race condition:
1. Временно включить более строгие блокировки
2. Мониторить количество активных сессий
3. При превышении лимитов - принудительно очистить старые сессии

### При рассинхронизации Redis/PostgreSQL:
1. Запустить скрипт синхронизации
2. Временно отключить Redis и работать только с БД
3. После синхронизации - восстановить работу Redis

---

*Документ создан: 2025-10-11*  
*Последнее обновление: 2025-10-11*  
*Версия: 1.0*