# Implementation Plan - Notification Service MVP

## Overview

Создать базовый микросервис уведомлений на NestJS + TypeScript для MVP российской игровой платформы с простыми уведомлениями в приложении и email уведомлениями.

## Tasks

- [ ] 1. Настройка NestJS проекта и базовой инфраструктуры
  - Создать NestJS проект с CLI: `nest new notification-service`
  - Настроить TypeScript конфигурацию с strict mode
  - Установить зависимости: @nestjs/typeorm, @nestjs/axios, @nestjs/cache-manager
  - Настроить ESLint, Prettier для code quality
  - Создать Dockerfile для development и production
  - Настроить docker-compose с PostgreSQL и Redis
  - _Requirements: 5_

- [ ] 2. Настройка TypeORM и базы данных
  - Настроить TypeORM модуль с PostgreSQL подключением
  - Создать Notification entity с базовыми полями (id, userId, type, title, message, isRead, priority, channels, timestamps)
  - Создать NotificationSettings entity с простыми настройками
  - Настроить миграции и индексы (userId, createdAt, type)
  - Добавить базовые enum для NotificationType, NotificationPriority, NotificationChannel
  - _Requirements: 1, 2_

- [ ] 3. Создание DTOs и валидации
  - Создать CreateNotificationDto с class-validator декораторами
  - Создать GetNotificationsDto с пагинацией
  - Создать UpdateNotificationSettingsDto с валидацией настроек
  - Добавить Swagger декораторы для API документации
  - Настроить глобальный ValidationPipe
  - _Requirements: 1, 2_

- [ ] 4. Реализация NotificationService с базовой бизнес-логикой
  - Создать NotificationService с dependency injection
  - Реализовать createNotification с проверкой настроек пользователя
  - Добавить getUserNotifications с пагинацией
  - Реализовать markAsRead с проверкой прав
  - Добавить getSettings и updateSettings для настроек пользователя
  - Интегрировать с Redis для кеширования настроек
  - _Requirements: 1, 2_

- [ ] 5. Настройка Redis кеширования
  - Настроить Redis модуль для кеширования
  - Добавить кеширование настроек пользователей
  - Реализовать базовую стратегию кеширования для MVP
  - _Requirements: 2, 5_

- [ ] 6. Реализация EmailService для российских провайдеров
  - Создать EmailService с поддержкой российских email провайдеров
  - Интегрировать с Mail.ru API или Yandex.Mail API
  - Создать простые email шаблоны с поддержкой русского языка
  - Реализовать sendNotificationEmail с базовой retry логикой
  - _Requirements: 3_

- [ ] 7. Создание NotificationController с REST API
  - Создать NotificationController с базовыми endpoints
  - Реализовать GET /notifications/user/:userId с пагинацией
  - Добавить POST /notifications с валидацией
  - Реализовать PUT /notifications/:id/read
  - Создать GET/PUT /notifications/settings/:userId
  - _Requirements: 1, 2, 4_

- [ ] 8. Настройка аутентификации и авторизации
  - Интегрировать JwtAuthGuard для защиты endpoints
  - Добавить проверку прав доступа к уведомлениям пользователя
  - Настроить CORS для кросс-доменных запросов
  - Добавить базовое логирование операций
  - _Requirements: 5_

- [ ] 9. Интеграция с другими микросервисами MVP
  - Создать простые HTTP endpoints для приема событий от других сервисов
  - Добавить базовую интеграцию с Payment Service для уведомлений о покупках
  - Интегрировать с Social Service для уведомлений о друзьях
  - Создать простой механизм отправки уведомлений через HTTP API
  - _Requirements: 4_

- [ ] 10. Написание тестов MVP
  - Создать unit тесты для NotificationService и EmailService с Jest
  - Написать integration тесты для API endpoints с Supertest
  - Создать mock сервисы для внешних API (email)
  - Настроить test database с Docker
  - Достичь 100% code coverage для критических путей
  - _Requirements: Все требования_

- [ ] 11. Настройка production конфигурации MVP
  - Создать production Dockerfile с оптимизацией
  - Настроить базовые Kubernetes манифесты (Deployment, Service, ConfigMap)
  - Добавить health check endpoints (/health)
  - Настроить базовое логирование
  - Создать production environment variables
  - Настроить graceful shutdown
  - _Requirements: 5_

- [ ] 12. Подготовка к развертыванию MVP
  - Провести базовое тестирование производительности
  - Создать документацию API
  - Подготовить инструкции по развертыванию
  - Протестировать интеграцию с другими сервисами
  - _Requirements: Все требования_