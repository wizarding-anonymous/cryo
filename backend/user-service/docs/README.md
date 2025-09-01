# User Service Documentation

Добро пожаловать в документацию User Service - центрального микросервиса российской игровой платформы Cryo.

## 📚 Структура документации

### 🚀 Быстрый старт
- [Установка и настройка](./installation.md)
- [Первые шаги](./getting-started.md)
- [Конфигурация](./configuration.md)

### 📖 API Документация
- [REST API Reference](./api/README.md)
- [WebSocket API](./api/websocket.md)
- [Аутентификация](./api/authentication.md)
- [Авторизация и роли](./api/authorization.md)

### 🏗️ Архитектура
- [Обзор архитектуры](./architecture/overview.md)
- [Доменная модель](./architecture/domain-model.md)
- [База данных](./architecture/database.md)
- [Интеграции](./architecture/integrations.md)

### 🔐 Безопасность
- [Обзор безопасности](./security/overview.md)
- [Соответствие 152-ФЗ](./security/compliance.md)
- [Российские SSO](./security/russian-sso.md)
- [MFA и аутентификация](./security/mfa.md)

### 🧪 Тестирование
- [Стратегия тестирования](./testing/strategy.md)
- [Unit тесты](./testing/unit-tests.md)
- [Integration тесты](./testing/integration-tests.md)
- [E2E тесты](./testing/e2e-tests.md)
- [Нагрузочное тестирование](./testing/load-testing.md)

### 🚀 Развертывание
- [Docker](./deployment/docker.md)
- [Kubernetes](./deployment/kubernetes.md)
- [Helm Charts](./deployment/helm.md)
- [CI/CD Pipeline](./deployment/cicd.md)

### 📊 Мониторинг
- [Метрики Prometheus](./monitoring/metrics.md)
- [Логирование](./monitoring/logging.md)
- [Алерты](./monitoring/alerts.md)
- [Troubleshooting](./monitoring/troubleshooting.md)

### 🔧 Разработка
- [Настройка окружения](./development/setup.md)
- [Стандарты кода](./development/coding-standards.md)
- [Процесс разработки](./development/workflow.md)
- [Отладка](./development/debugging.md)

## 🎯 Быстрые ссылки

### Для разработчиков
- [API Swagger UI](http://localhost:3001/api-docs) - Интерактивная документация API
- [Health Check](http://localhost:3001/health) - Проверка состояния сервиса
- [Metrics](http://localhost:3001/metrics) - Prometheus метрики

### Для DevOps
- [Docker Compose](../docker-compose.yml) - Локальное развертывание
- [Kubernetes Manifests](../k8s/) - Production развертывание
- [Helm Chart](../helm/) - Управление конфигурацией

### Для QA
- [Postman Collection](./postman/) - Коллекция для тестирования API
- [Test Cases](./testing/) - Тест-кейсы и сценарии
- [Load Tests](../load-tests/) - Нагрузочные тесты

## 🆘 Поддержка

### Каналы связи
- **GitHub Issues**: [Создать issue](https://github.com/cryo-platform/user-service/issues/new)
- **Slack**: #user-service-support
- **Email**: support@cryo-platform.ru

### Команда разработки
- **Tech Lead**: [Имя] - [email]
- **Backend Team**: [Имена] - [emails]
- **DevOps Team**: [Имена] - [emails]

## 📋 Статус документации

| Раздел | Статус | Последнее обновление |
|--------|--------|---------------------|
| API Reference | ✅ Готово | 2025-09-01 |
| Архитектура | ✅ Готово | 2025-09-01 |
| Безопасность | ✅ Готово | 2025-09-01 |
| Тестирование | ✅ Готово | 2025-09-01 |
| Развертывание | ✅ Готово | 2025-09-01 |
| Мониторинг | ✅ Готово | 2025-09-01 |
| Troubleshooting | 🔄 В процессе | 2025-09-01 |

## 🔄 Обновления документации

Документация обновляется автоматически при каждом релизе. Для предложения изменений:

1. Создайте issue с описанием проблемы
2. Отправьте Pull Request с исправлениями
3. Обновления будут рассмотрены командой разработки

---

**Последнее обновление:** 1 сентября 2025  
**Версия User Service:** 2.0.0  
**Статус:** Production Ready ✅