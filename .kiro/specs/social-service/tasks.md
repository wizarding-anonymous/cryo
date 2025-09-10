# Implementation Plan - Social Service MVP

## Overview

Реализовать Social Service MVP для Месяца 3 с использованием NestJS + TypeScript. Включает только базовые социальные функции: систему друзей, простые сообщения и онлайн статусы для российской игровой платформы.

## Tasks

- [ ] 1. Настройка NestJS проекта и базовой инфраструктуры
  - Создать новый NestJS проект с CLI: `nest new social-service`
  - Настроить TypeScript конфигурацию с strict режимом
  - Установить зависимости: @nestjs/typeorm, @nestjs/axios, @nestjs/cache-manager
  - Настроить ESLint, Prettier для code quality
  - Создать базовую структуру модулей (AppModule, FriendsModule, MessagesModule, StatusModule)
  - _Requirements: 5_

- [ ] 2. Настройка TypeORM и базы данных
  - Настроить TypeORM модуль с PostgreSQL подключением
  - Создать Friendship entity с индексами и ограничениями
  - Реализовать Message entity для простых сообщений
  - Создать OnlineStatus entity для отслеживания статусов
  - Настроить миграции и добавить Redis для кеширования
  - _Requirements: 1, 2, 3_

- [ ] 3. Создание DTO классов с валидацией
  - Реализовать SendFriendRequestDto, SendMessageDto с class-validator
  - Создать response DTO для друзей, сообщений, статусов
  - Добавить query DTO для пагинации и фильтрации
  - Настроить Swagger decorators для документации
  - _Requirements: 1, 2, 3_

- [ ] 4. Реализация FriendsService с бизнес-логикой
  - Создать FriendsService с dependency injection
  - Реализовать sendFriendRequest с валидацией дубликатов
  - Добавить acceptFriendRequest, declineFriendRequest, removeFriend
  - Создать getFriends с пагинацией и searchUsers
  - _Requirements: 1_

- [ ] 5. Реализация MessagingService для простых сообщений
  - Создать MessagingService для сообщений между друзьями
  - Реализовать sendMessage с проверкой дружбы
  - Добавить getConversations и getConversation с историей
  - Реализовать markAsRead и базовый rate limiting
  - _Requirements: 3_

- [ ] 6. Создание StatusService для онлайн статусов
  - Реализовать StatusService для управления статусами
  - Добавить setOnlineStatus, setOfflineStatus, getFriendsStatus
  - Создать updateLastSeen и автоматический переход в "отошел"
  - Настроить кеширование статусов в Redis
  - _Requirements: 2_

- [ ] 7. Создание Controllers с REST API
  - Реализовать FriendsController с endpoints для управления друзьями
  - Создать MessagesController для простых сообщений
  - Добавить StatusController для онлайн статусов
  - Настроить Swagger документацию для всех endpoints
  - _Requirements: 1, 2, 3_

- [ ] 8. Создание Guards для аутентификации и авторизации
  - Реализовать JwtAuthGuard для проверки JWT токенов
  - Создать FriendshipGuard для проверки дружбы перед отправкой сообщений
  - Добавить базовый RateLimitGuard для ограничения частоты сообщений
  - _Requirements: 3, 4_

- [ ] 9. Интеграция с внешними сервисами
  - Создать HTTP клиенты для User Service и Notification Service
  - Добавить базовую retry логику для отказоустойчивости
  - Настроить кеширование пользовательских данных
  - _Requirements: 4_

- [ ] 10. Написание тестов MVP
  - Создать unit тесты для всех Services (Friends, Messaging, Status)
  - Написать integration тесты для API endpoints с Supertest
  - Добавить тесты для Guards и бизнес-логики
  - Достичь 100% code coverage для критических путей
  - _Requirements: Все требования_

- [ ] 11. Настройка production конфигурации MVP
  - Создать production Dockerfile с оптимизацией
  - Настроить базовые Kubernetes манифесты (Deployment, Service, ConfigMap)
  - Добавить health check endpoints
  - Настроить базовое логирование и graceful shutdown
  - _Requirements: 5_

- [ ] 12. Подготовка к развертыванию MVP
  - Провести базовое тестирование производительности для 1000 пользователей
  - Создать документацию API
  - Протестировать интеграцию с другими сервисами
  - Подготовить инструкции по развертыванию
  - _Requirements: Все требования_