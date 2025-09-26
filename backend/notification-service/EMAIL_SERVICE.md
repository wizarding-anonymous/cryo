# EmailService для российских провайдеров

## Обзор

EmailService реализует отправку email уведомлений с поддержкой российских email провайдеров (Mail.ru и Yandex.Mail) и базовой retry логикой.

## Поддерживаемые провайдеры

### 1. Mail.ru API
- Провайдер: `mailru`
- URL: `https://api.mail.ru/v1/email/send`
- Аутентификация: Bearer token
- Формат payload: Mail.ru API format

### 2. Yandex.Mail API
- Провайдер: `yandex`
- URL: `https://api.yandex.ru/v1/mail/send`
- Аутентификация: X-Yandex-API-Key
- Формат payload: Yandex API format

### 3. Generic Provider
- Провайдер: `generic`
- Универсальный формат для других провайдеров
- Аутентификация: X-Api-Key

## Конфигурация

Добавьте в `.env` файл:

```bash
# Основная конфигурация
EMAIL_PROVIDER=mailru  # mailru, yandex, или generic
EMAIL_URL=https://api.mail.ru/v1/email/send
EMAIL_API_KEY=your-api-key
EMAIL_FROM=noreply@myplatform.ru

# Настройки retry логики
EMAIL_MAX_RETRIES=3
EMAIL_RETRY_DELAY=1000
```

## Шаблоны email

Сервис поддерживает различные шаблоны для разных типов уведомлений:

- `notification.html` - базовый шаблон (по умолчанию)
- `purchase.html` - для уведомлений о покупках
- `achievement.html` - для уведомлений о достижениях
- `friend-request.html` - для заявок в друзья

Все шаблоны поддерживают русский язык и используют переменные `{{title}}` и `{{message}}`.

## Retry логика

- Автоматические повторные попытки при ошибках
- Настраиваемое количество попыток (по умолчанию 3)
- Настраиваемая задержка между попытками (по умолчанию 1000ms)
- Логирование всех попыток и ошибок

## Использование

```typescript
// Отправка уведомления
await emailService.sendNotificationEmail(
  'user@example.com',
  notification
);

// Прямая отправка email
await emailService.sendEmail(
  'user@example.com',
  'Тема письма',
  '<h1>HTML содержимое</h1>'
);
```

## Особенности для российских провайдеров

### Mail.ru
- Отправляет и HTML и текстовую версию
- Использует Bearer аутентификацию
- Поддерживает имя отправителя "Игровая Платформа"

### Yandex.Mail
- Отправляет и HTML и текстовую версию
- Использует X-Yandex-API-Key аутентификацию
- Поддерживает имя отправителя "Игровая Платформа"

## Тестирование

Сервис покрыт unit тестами, включая:
- Тестирование всех провайдеров
- Тестирование retry логики
- Тестирование шаблонов
- Тестирование обработки ошибок

Запуск тестов:
```bash
npm test email.service.spec.ts
```