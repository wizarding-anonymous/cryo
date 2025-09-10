# Implementation Plan - Review Service MVP

## Overview

Создать базовый сервис отзывов для MVP российской игровой платформы с простыми отзывами и рейтингами за 1 месяц.

## Tasks

- [ ] 1. Настройка проекта и базовой инфраструктуры
  - Создать новый проект с `nest new review-service`
  - Установить зависимости: @nestjs/typeorm, @nestjs/axios, @nestjs/cache-manager, class-validator, class-transformer
  - Настроить TypeScript, ESLint, Prettier, Jest (встроенные в NestJS)
  - Создать Dockerfile для development и production
  - Настроить docker-compose с PostgreSQL и Redis
  - Создать конфигурационные модули NestJS
  - _Requirements: Все требования_

- [ ] 2. Настройка базы данных и кеширования
  - Настроить TypeORM модуль в NestJS с PostgreSQL
  - Создать Review и GameRating entities с декораторами TypeORM
  - Настроить систему миграций TypeORM
  - Создать индексы для gameId, userId и составной индекс (gameId, userId)
  - Настроить Redis для кеширования рейтингов игр
  - _Requirements: 1, 2, 3, 4_

- [ ] 3. Реализация базовых доменных моделей
  - Создать Review entity с декораторами TypeORM (@Entity, @Column, @PrimaryGeneratedColumn, @Index)
  - Создать GameRating entity с составным ключом по gameId
  - Создать DTO классы с class-validator декораторами (CreateReviewDto, UpdateReviewDto, PaginationDto)
  - Реализовать валидацию текста отзыва (10-1000 символов) и рейтинга (1-5 звезд)
  - _Requirements: 1, 2_

- [ ] 4. Реализация сервисов бизнес-логики
  - Создать ReviewService с методами: createReview, getGameReviews, updateReview, deleteReview, getUserReviews
  - Создать RatingService с методами: calculateGameRating, updateGameRating, getGameRating
  - Создать OwnershipService для проверки владения игрой через Library Service
  - Реализовать проверку уникальности отзыва (один отзыв на игру от пользователя)
  - Добавить dependency injection через NestJS декораторы
  - _Requirements: 1, 3, 4_

- [ ] 5. Реализация интеграции с внешними сервисами
  - Настроить HttpModule для взаимодействия с Library Service
  - Реализовать проверку владения игрой перед созданием отзыва
  - Добавить обработку ошибок внешних сервисов
  - Создать retry механизм для HTTP запросов
  - Добавить кеширование результатов проверки владения
  - _Requirements: 1, 4_

- [ ] 6. Создание REST API контроллеров
  - Создать ReviewController с эндпоинтами: POST /reviews, GET /reviews/game/:gameId, PUT /reviews/:id, DELETE /reviews/:id
  - Создать RatingController с эндпоинтом: GET /ratings/game/:gameId
  - Добавить Swagger декораторы для автоматической документации API
  - Реализовать валидацию входных данных через ValidationPipe
  - Добавить пагинацию для списка отзывов (по 10 штук)
  - _Requirements: 1, 2, 3, 4_

- [ ] 7. Добавление middleware и guards
  - Настроить JwtAuthGuard для защиты эндпоинтов создания/редактирования отзывов
  - Создать OwnershipGuard для проверки прав на редактирование отзыва
  - Добавить ValidationPipe для автоматической валидации DTO
  - Настроить CacheInterceptor для кеширования рейтингов игр
  - Создать ExceptionFilter для унифицированной обработки ошибок
  - _Requirements: 4, 5_

- [ ] 8. Реализация системы рейтингов и кеширования
  - Реализовать автоматический пересчет рейтинга игры при создании/обновлении/удалении отзыва
  - Добавить кеширование рейтингов в Redis с TTL 5 минут
  - Создать фоновую задачу для пересчета рейтингов всех игр
  - Реализовать инвалидацию кеша при изменении отзывов
  - Добавить метрики производительности для операций с рейтингами
  - _Requirements: 2, 3_

- [ ] 9. Тестирование и документация API
  - Написать unit тесты для всех сервисов (ReviewService, RatingService, OwnershipService)
  - Создать integration тесты для REST API эндпоинтов с supertest
  - Добавить e2e тесты для полных сценариев создания и просмотра отзывов
  - Протестировать интеграцию с Library Service (mock внешние вызовы)
  - Настроить автоматическую генерацию Swagger документации
  - Создать health check эндпоинт GET /health для мониторинга
  - _Requirements: Все требования_

- [ ] 10. Подготовка к production развертыванию MVP
  - Создать оптимизированный Dockerfile
  - Настроить базовые Kubernetes манифесты (Deployment, Service, ConfigMap)
  - Добавить health check endpoints
  - Настроить базовое логирование
  - Провести нагрузочное тестирование для 1000 пользователей
  - _Requirements: Все требования_