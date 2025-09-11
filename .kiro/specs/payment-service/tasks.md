# Implementation Plan - Payment Service MVP

## Overview

Создать критически важный сервис платежей для MVP российской игровой платформы на NestJS с имитацией российских платежных систем через REST API за 1 месяц.

## Tasks

- [x] 1. Настройка проекта и базовой инфраструктуры


  - Создать новый проект с `nest new payment-service`
  - Установить зависимости: @nestjs/typeorm, @nestjs/jwt, @nestjs/passport, @nestjs/axios, @nestjs/cache-manager, class-validator, class-transformer
  - Настроить TypeScript, ESLint, Prettier, Jest (встроенные в NestJS)
  - Создать Dockerfile для development и production
  - Настроить docker-compose с PostgreSQL и Redis
  - Создать конфигурационные модули NestJS
  - _Requirements: Все требования_



- [ ] 2. Настройка базы данных и кеширования
  - Настроить TypeORM модуль в NestJS с PostgreSQL
  - Создать Order и Payment entities с декораторами TypeORM
  - Настроить систему миграций TypeORM
  - Создать индексы для userId, orderId, status и externalId
  - Настроить Redis для кеширования статусов платежей и заказов
  - _Requirements: 1, 2, 3_

- [ ] 3. Реализация базовых доменных моделей
  - Создать Order entity с декораторами TypeORM (@Entity, @Column, @PrimaryGeneratedColumn, @CreateDateColumn)
  - Создать Payment entity с связями к Order (@ManyToOne, @JoinColumn)
  - Создать DTO классы с class-validator декораторами (CreateOrderDto, CreatePaymentDto, GetOrdersQueryDto, PaymentWebhookDto)
  - Реализовать валидацию сумм, валют и статусов с class-validator
  - Добавить enum типы для статусов и провайдеров
  - _Requirements: 1, 2, 3, 4_

- [ ] 4. Реализация сервисов бизнес-логики
  - Создать OrderService с методами: createOrder, getOrder, getUserOrders, updateOrderStatus
  - Создать PaymentService с методами: createPayment, processPayment, confirmPayment, cancelPayment, getPayment
  - Создать PaymentProviderService с методами: processPayment, getPaymentStatus, handleWebhook
  - Реализовать проверку существования заказов и валидацию владельца через TypeORM repository
  - Добавить dependency injection через NestJS декораторы
  - _Requirements: 1, 2, 3, 4_

- [ ] 5. Реализация имитации российских платежных систем
  - Создать PaymentProvider интерфейс для абстракции провайдеров
  - Реализовать SberbankPaymentProvider с имитацией API Сбербанк Онлайн
  - Реализовать YMoneyPaymentProvider с имитацией API ЮMoney
  - Реализовать TBankPaymentProvider с имитацией API Т-Банк
  - Добавить конфигурацию mock URL и ключей через ConfigService
  - Создать mock HTML формы для тестирования платежей
  - _Requirements: 2_

- [ ] 6. Реализация JWT аутентификации и авторизации
  - Настроить Passport.js стратегии (JwtStrategy)
  - Создать JwtAuthGuard для защиты всех эндпоинтов
  - Реализовать валидацию JWT токенов
  - Добавить проверку владельца заказа в OrderService
  - Создать unit тесты для всех guards и стратегий
  - _Requirements: 4, 5_

- [ ] 7. Создание REST API контроллеров
  - Создать OrderController с эндпоинтами: POST /orders, GET /orders/:id, GET /orders
  - Создать PaymentController с эндпоинтами: POST /payments, GET /payments/:id, POST /payments/:id/confirm, POST /payments/:id/cancel
  - Добавить Swagger декораторы для автоматической документации API
  - Реализовать валидацию входных данных через ValidationPipe
  - Добавить обработку ошибок через ExceptionFilter
  - _Requirements: 1, 2, 3, 4_

- [ ] 8. Добавление middleware и interceptors
  - Настроить глобальный ValidationPipe для автоматической валидации DTO
  - Создать GlobalExceptionFilter для унифицированной обработки ошибок
  - Добавить LoggingInterceptor для логирования всех запросов
  - Настроить CacheInterceptor для кеширования статусов платежей
  - Создать ResponseInterceptor для стандартизации ответов API
  - Добавить ThrottlerGuard для rate limiting
  - _Requirements: 4, 5_

- [ ] 9. Настройка конфигурации и окружения
  - Создать ConfigModule для управления переменными окружения
  - Настроить различные конфигурации для development, testing, production
  - Добавить валидацию переменных окружения с Joi
  - Создать DatabaseModule для подключения к PostgreSQL и Redis
  - Настроить логирование с Winston для платежных операций
  - _Requirements: Все требования_

- [ ] 10. Тестирование и документация API
  - Написать unit тесты для всех сервисов (OrderService, PaymentService, PaymentProviderService)
  - Создать integration тесты для REST API эндпоинтов с supertest
  - Добавить e2e тесты для полных сценариев создания заказа и платежа
  - Протестировать имитацию всех трех платежных провайдеров
  - Настроить автоматическую генерацию Swagger документации
  - Создать health check эндпоинт GET /health для мониторинга
  - _Requirements: Все требования_

- [ ] 11. Подготовка к production развертыванию
  - Создать оптимизированный Dockerfile с multi-stage build
  - Настроить Kubernetes манифесты (Deployment, Service, ConfigMap, Secret)
  - Добавить Prometheus метрики через @nestjs/prometheus для мониторинга платежей
  - Настроить structured logging с correlation ID для трейсинга платежных операций
  - Провести нагрузочное тестирование API эндпоинтов (1000+ одновременных пользователей)
  - Настроить мониторинг критических метрик (время обработки платежей, успешность)
  - _Requirements: Все требования_