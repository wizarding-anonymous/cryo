# Руководство по обработке ошибок в User Service

## Обзор

User Service использует стандартизированную систему обработки ошибок с типизированными кодами ошибок, correlation ID для трассировки и интеграцией с логированием и мониторингом.

## Основные компоненты

### 1. UserServiceError

Стандартизированный класс ошибок с типизированными кодами:

```typescript
import { UserServiceError, ErrorCodes } from '../common/errors';

// Создание ошибки "Пользователь не найден"
throw UserServiceError.userNotFound(userId, correlationId);

// Создание ошибки "Пользователь уже существует"
throw UserServiceError.userAlreadyExists(email, correlationId);

// Создание ошибки валидации
throw UserServiceError.validationError('Invalid input', 'field', value, correlationId);
```

### 2. GlobalExceptionFilter

Автоматически обрабатывает все ошибки и формирует стандартизированные ответы:

```json
{
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "Пользователь с ID 123 не найден",
    "correlationId": "usr-1697123456-abc123",
    "timestamp": "2023-10-12T10:30:00.000Z",
    "path": "/api/users/123",
    "details": {
      "field": "id",
      "value": "123"
    }
  }
}
```

### 3. Correlation ID Middleware

Автоматически генерирует и передает correlation ID для трассировки запросов.

## Использование в сервисах

```typescript
async updateUser(id: string, updateData: UpdateUserDto, correlationId?: string): Promise<User> {
  try {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw UserServiceError.userNotFound(id, correlationId);
    }
    
    // Логика обновления...
    return updatedUser;
  } catch (error) {
    if (error instanceof UserServiceError) {
      throw error; // Пробрасываем дальше
    }
    
    // Оборачиваем неожиданные ошибки
    throw UserServiceError.databaseError('Failed to update user', error, correlationId);
  }
}
```

## Коды ошибок

- `USER_NOT_FOUND` - Пользователь не найден
- `USER_ALREADY_EXISTS` - Пользователь уже существует  
- `VALIDATION_ERROR` - Ошибка валидации
- `DATABASE_ERROR` - Ошибка базы данных
- `RATE_LIMIT_EXCEEDED` - Превышен лимит запросов

Полный список в `ErrorCodes`.