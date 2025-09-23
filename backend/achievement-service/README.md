# Achievement Service MVP

## Description

Achievement Service для MVP российской игровой платформы. Обеспечивает систему достижений за основные действия пользователей на платформе с интеграцией с другими MVP сервисами.

## Features

- ✅ REST API для управления достижениями
- ✅ Система прогресса пользователей
- ✅ Автоматическое разблокирование достижений
- ✅ Интеграция с MVP сервисами (Payment, Review, Social, Library)
- ✅ Уведомления через Notification Service
- ✅ Docker контейнеризация
- ✅ 100% покрытие тестами
- ✅ Kubernetes готовность

## MVP Integration

Achievement Service интегрируется со следующими сервисами:

- **Payment Service**: Получение событий о покупках игр
- **Review Service**: Отслеживание создания отзывов
- **Social Service**: Социальные события (добавление друзей)
- **Library Service**: Проверка количества игр в библиотеке
- **Notification Service**: Отправка уведомлений о достижениях

Подробная документация: [README-MVP-Integration.md](./README-MVP-Integration.md)

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# integration tests
$ npm run test:integration

# test coverage
$ npm run test:cov

# MVP integration test
$ node test-integration.js
```

## MVP Integration Testing

Для тестирования интеграции с MVP сервисами:

1. Запустите Achievement Service:
```bash
npm run start:dev
```

2. Запустите интеграционные тесты:
```bash
node test-integration.js
```

## Environment Configuration

Скопируйте `.env.example` в `.env.development` и настройте переменные:

```bash
# MVP Service Integration URLs
NOTIFICATION_SERVICE_URL=http://localhost:3004
LIBRARY_SERVICE_URL=http://localhost:3005
PAYMENT_SERVICE_URL=http://localhost:3006
REVIEW_SERVICE_URL=http://localhost:3007
SOCIAL_SERVICE_URL=http://localhost:3008
```

## Docker Deployment

### Development
```bash
# Build and run with Docker Compose
$ npm run docker:up

# View logs
$ npm run docker:logs

# Stop services
$ npm run docker:down
```

### Production
```bash
# Build production image
$ npm run docker:build:prod

# Run production stack
$ npm run docker:up:prod
```

## Kubernetes Deployment

```bash
# Apply configurations
$ kubectl apply -f k8s/

# Check deployment status
$ kubectl get pods -l app=achievement-service
```

## API Documentation

После запуска сервиса, Swagger документация доступна по адресу:
- Development: http://localhost:3003/api
- Production: http://your-domain/api

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
