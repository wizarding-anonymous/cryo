# Implementation Plan - Library Service Refactoring

- [X] 1. Подготовка новой архитектуры аутентификации
  - Создать AuthServiceClient для интеграции с Auth Service
  - Реализовать AuthServiceGuard для замены JwtAuthGuard
  - Обновить InternalServiceGuard для service-to-service аутентификации
  - Добавить fallback механизм для локальной валидации JWT
  - _Requirements: 1.1, 2.1, 2.2, 2.4_

- [x] 2. Обновление кэширования с namespace
  - Обновить CacheService для использования namespace "library:"
  - Реализовать методы mget и mset для batch операций
  - Добавить invalidateUserLibraryCache с поддержкой patterns
  - Обновить все места использования кэша для работы с namespace
  - _Requirements: 6.1, 6.2, 6.3, 3.3_

- [X] 3. Удаление устаревшего auth модуля
  - ✅ Удалить папку src/auth и все её содержимое
  - ✅ Удалить зависимости @nestjs/passport, @nestjs/jwt, passport-jwt
  - ✅ Обновить app.module.ts для удаления AuthModule
  - ✅ Очистить package.json от неиспользуемых auth зависимостей
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 4. Обновление контроллеров и guards
  - Заменить JwtAuthGuard на AuthServiceGuard во всех контроллерах
  - Обновить InternalAuthGuard на InternalServiceGuard
  - Обновить импорты в LibraryController и HistoryController
  - Обновить типы AuthenticatedRequest для новой структуры пользователя
  - _Requirements: 2.1, 2.3, 4.1, 8.1_

- [ ] 5. Стандартизация API responses
  - Создать StandardResponseDto для единообразных ответов
  - Обновить все DTOs для использования стандартного формата
  - Обновить GlobalExceptionFilter для стандартизированных ошибок
  - Добавить correlation ID и request tracking
  - _Requirements: 8.1, 8.2, 7.2_

- [ ] 6. Оптимизация производительности
  - Добавить Circuit Breaker для внешних сервисов
  - Оптимизировать enrichWithGameDetails для batch операций
  - Реализовать connection pooling для внешних HTTP запросов
  - Добавить retry механизмы с exponential backoff
  - _Requirements: 3.1, 3.2, 5.1, 5.2_

- [ ] 7. Обновление мониторинга и логирования
  - Добавить метрики для Auth Service интеграции
  - Обновить health checks для проверки Auth Service
  - Добавить структурированное логирование с correlation ID
  - Реализовать алерты для деградации производительности
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ] 8. Обновление конфигурации
  - Добавить конфигурацию для Auth Service (URL, timeout, retries)
  - Обновить environment variables и .env файлы
  - Добавить конфигурацию для internal service authentication
  - Обновить Docker и Kubernetes конфигурации
  - _Requirements: 2.1, 6.1, 9.3_

- [ ] 9. Обновление тестов
  - Обновить unit тесты для новых guards и services
  - Создать integration тесты для Auth Service интеграции
  - Обновить e2e тесты для новой аутентификации
  - Добавить тесты для fallback механизмов
  - _Requirements: 9.1, 9.4_

- [ ]* 9.1 Создать тесты производительности
  - Написать load тесты для проверки производительности после рефакторинга
  - Создать benchmark тесты для сравнения до/после
  - _Requirements: 3.1, 3.2_

- [ ] 10. Обновление документации
  - Обновить API документацию (Swagger) для новых endpoints
  - Создать migration guide для других команд
  - Обновить README с новыми требованиями к окружению
  - Документировать новые environment variables
  - _Requirements: 8.3, 9.2_

- [ ] 11. Интеграция с общей инфраструктурой
  - Обновить docker-compose.yml для использования общего Redis
  - Проверить интеграцию с общим CI/CD pipeline
  - Обновить Kubernetes манифесты для новых зависимостей
  - Настроить мониторинг в общей системе наблюдения
  - _Requirements: 6.1, 9.1, 9.2, 9.3_

- [ ] 12. Безопасность и аудит
  - Реализовать логирование всех операций с userId
  - Добавить проверки ownership для всех endpoints
  - Реализовать rate limiting для предотвращения злоупотреблений
  - Добавить audit trail для критических операций
  - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [ ]* 12.1 Создать security тесты
  - Написать тесты для проверки authorization
  - Создать тесты для проверки rate limiting
  - _Requirements: 10.1, 10.3_

- [ ] 13. Финальная интеграция и тестирование
  - Провести полное интеграционное тестирование с Auth Service
  - Выполнить нагрузочное тестирование обновленного сервиса
  - Проверить работу всех fallback механизмов
  - Провести security audit обновленного кода
  - _Requirements: 2.1, 3.1, 7.4, 10.4_

- [ ] 14. Деплой и мониторинг
  - Развернуть обновленный сервис в staging окружении
  - Провести smoke тесты в staging
  - Настроить мониторинг и алерты для production
  - Подготовить rollback план на случай проблем
  - _Requirements: 9.1, 9.2, 7.3, 7.4_