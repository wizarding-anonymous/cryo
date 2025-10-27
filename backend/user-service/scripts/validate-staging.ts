#!/usr/bin/env ts-node

/**
 * Staging Validation Script for User Service
 *
 * Этот скрипт выполняет комплексную валидацию User Service в staging окружении:
 * 1. Проверка развертывания и health checks
 * 2. Тестирование интеграции с Auth Service и другими микросервисами
 * 3. Валидация работы с общим Redis и PostgreSQL
 * 4. Проверка производительности и мониторинга
 */

import axios from 'axios';
import { performance } from 'perf_hooks';

interface ValidationResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  duration?: number;
  details?: unknown;
}

class StagingValidator {
  private baseUrl: string;
  private results: ValidationResult[] = [];

  constructor(baseUrl = 'http://localhost:3002') {
    this.baseUrl = baseUrl;
  }

  private async addResult(
    test: string,
    status: 'PASS' | 'FAIL' | 'WARN',
    message: string,
    details?: unknown,
    duration?: number,
  ) {
    this.results.push({ test, status, message, details, duration });
    const emoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
    const durationStr = duration ? ` (${duration.toFixed(2)}ms)` : '';
    console.log(`${emoji} ${test}: ${message}${durationStr}`);
  }

  private async makeRequest(url: string, options: Record<string, unknown> = {}) {
    const start = performance.now();
    try {
      const response = await axios({
        url,
        timeout: 10000,
        ...options,
      });
      const duration = performance.now() - start;
      return { response, duration };
    } catch (error) {
      const duration = performance.now() - start;
      throw { error, duration };
    }
  }

  // 1. Проверка развертывания и health checks
  async validateDeployment() {
    console.log('\n🚀 Проверка развертывания User Service...\n');

    // Health check - liveness
    try {
      const { response, duration } = await this.makeRequest(`${this.baseUrl}/api/health/live`);
      await this.addResult(
        'Health Check - Liveness',
        'PASS',
        'Сервис отвечает на liveness probe',
        response.data,
        duration
      );
    } catch ({ error, duration }) {
      await this.addResult(
        'Health Check - Liveness',
        'FAIL',
        `Сервис не отвечает: ${error.message}`,
        error.response?.data,
        duration
      );
      return false;
    }

    // Health check - readiness
    try {
      const { response, duration } = await this.makeRequest(`${this.baseUrl}/api/health/ready`);
      const healthData = response.data;
      
      if (healthData.status === 'ok') {
        await this.addResult(
          'Health Check - Readiness',
          'PASS',
          'Все зависимости доступны',
          healthData,
          duration
        );
      } else {
        await this.addResult(
          'Health Check - Readiness',
          'WARN',
          'Некоторые зависимости недоступны',
          healthData,
          duration
        );
      }
    } catch ({ error, duration }) {
      await this.addResult(
        'Health Check - Readiness',
        'FAIL',
        `Ошибка readiness probe: ${error.message}`,
        error.response?.data,
        duration
      );
    }

    // Проверка метрик Prometheus
    try {
      const { response, duration } = await this.makeRequest(`${this.baseUrl}/metrics`);
      const metricsText = response.data;
      
      if (metricsText.includes('user_service_') && metricsText.includes('nodejs_')) {
        await this.addResult(
          'Prometheus Metrics',
          'PASS',
          'Метрики экспортируются корректно',
          { metricsCount: metricsText.split('\n').length },
          duration
        );
      } else {
        await this.addResult(
          'Prometheus Metrics',
          'WARN',
          'Метрики неполные или отсутствуют',
          null,
          duration
        );
      }
    } catch ({ error, duration }) {
      await this.addResult(
        'Prometheus Metrics',
        'FAIL',
        `Ошибка получения метрик: ${error.message}`,
        null,
        duration
      );
    }

    return true;
  }

  // 2. Тестирование интеграции с Auth Service
  async validateAuthServiceIntegration() {
    console.log('\n🔐 Проверка интеграции с Auth Service...\n');

    // Создание тестового пользователя через внутренний API
    const testUser = {
      email: `staging-test-${Date.now()}@example.com`,
      password: 'hashed_password_from_auth_service',
      name: 'Staging Test User'
    };

    try {
      const { response, duration } = await this.makeRequest(`${this.baseUrl}/api/internal/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'auth-service-staging-key-32chars',
          'x-internal-service': 'auth-service'
        },
        data: testUser
      });

      const createdUser = response.data.data;
      await this.addResult(
        'Auth Service - User Creation',
        'PASS',
        'Пользователь создан через внутренний API',
        { userId: createdUser.id },
        duration
      );

      // Проверка получения пользователя по email
      try {
        const { response: getUserResponse, duration: getUserDuration } = await this.makeRequest(
          `${this.baseUrl}/api/internal/users/email/${testUser.email}`,
          {
            headers: {
              'x-api-key': 'auth-service-staging-key-32chars',
              'x-internal-service': 'auth-service'
            }
          }
        );

        await this.addResult(
          'Auth Service - User Lookup',
          'PASS',
          'Пользователь найден по email',
          { userId: getUserResponse.data.data.id },
          getUserDuration
        );
      } catch ({ error, duration }) {
        await this.addResult(
          'Auth Service - User Lookup',
          'FAIL',
          `Ошибка поиска пользователя: ${error.message}`,
          null,
          duration
        );
      }

      // Обновление lastLoginAt
      try {
        const { response: updateResponse, duration: updateDuration } = await this.makeRequest(
          `${this.baseUrl}/api/internal/users/${createdUser.id}/last-login`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': 'auth-service-staging-key-32chars',
              'x-internal-service': 'auth-service'
            },
            data: { lastLoginAt: new Date().toISOString() }
          }
        );

        await this.addResult(
          'Auth Service - Last Login Update',
          'PASS',
          'Время последнего входа обновлено',
          null,
          updateDuration
        );
      } catch ({ error, duration }) {
        await this.addResult(
          'Auth Service - Last Login Update',
          'FAIL',
          `Ошибка обновления lastLoginAt: ${error.message}`,
          null,
          duration
        );
      }

      return createdUser.id;
    } catch ({ error, duration }) {
      await this.addResult(
        'Auth Service - User Creation',
        'FAIL',
        `Ошибка создания пользователя: ${error.message}`,
        error.response?.data,
        duration
      );
      return null;
    }
  }

  // 3. Тестирование интеграции с другими микросервисами
  async validateMicroservicesIntegration(userId: string) {
    console.log('\n🎮 Проверка интеграции с другими микросервисами...\n');

    // Game Catalog Service - получение профиля пользователя
    try {
      const { response, duration } = await this.makeRequest(
        `${this.baseUrl}/api/internal/users/${userId}/profile`,
        {
          headers: {
            'x-api-key': 'game-catalog-staging-key-32chars',
            'x-internal-service': 'game-catalog-service'
          }
        }
      );

      await this.addResult(
        'Game Catalog Integration',
        'PASS',
        'Профиль пользователя получен для Game Catalog Service',
        null,
        duration
      );
    } catch ({ error, duration }) {
      await this.addResult(
        'Game Catalog Integration',
        'FAIL',
        `Ошибка интеграции с Game Catalog: ${error.message}`,
        null,
        duration
      );
    }

    // Payment Service - получение биллинговой информации
    try {
      const { response, duration } = await this.makeRequest(
        `${this.baseUrl}/api/internal/users/${userId}/billing-info`,
        {
          headers: {
            'x-api-key': 'payment-service-staging-key-32chars',
            'x-internal-service': 'payment-service'
          }
        }
      );

      await this.addResult(
        'Payment Service Integration',
        'PASS',
        'Биллинговая информация получена для Payment Service',
        null,
        duration
      );
    } catch ({ error, duration }) {
      await this.addResult(
        'Payment Service Integration',
        'FAIL',
        `Ошибка интеграции с Payment Service: ${error.message}`,
        null,
        duration
      );
    }

    // Batch операции для Library Service
    try {
      const { response, duration } = await this.makeRequest(
        `${this.baseUrl}/api/internal/batch/users/profiles`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'library-service-staging-key-32chars',
            'x-internal-service': 'library-service'
          },
          data: { userIds: [userId] }
        }
      );

      await this.addResult(
        'Library Service - Batch Operations',
        'PASS',
        'Batch операция выполнена для Library Service',
        null,
        duration
      );
    } catch ({ error, duration }) {
      await this.addResult(
        'Library Service - Batch Operations',
        'FAIL',
        `Ошибка batch операции: ${error.message}`,
        null,
        duration
      );
    }
  }

  // 4. Проверка работы с общим Redis и PostgreSQL
  async validateSharedInfrastructure() {
    console.log('\n🗄️ Проверка работы с общей инфраструктурой...\n');

    // Проверка кэширования Redis
    const testCacheKey = `staging-test-${Date.now()}`;
    const testCacheValue = { test: 'staging-validation', timestamp: new Date().toISOString() };

    try {
      // Создание пользователя для тестирования кэша
      const testUser = {
        email: `cache-test-${Date.now()}@example.com`,
        password: 'hashed_password',
        name: 'Cache Test User'
      };

      const { response: createResponse, duration: createDuration } = await this.makeRequest(
        `${this.baseUrl}/api/internal/users`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'auth-service-staging-key-32chars',
            'x-internal-service': 'auth-service'
          },
          data: testUser
        }
      );

      const userId = createResponse.data.data.id;

      // Первый запрос - должен попасть в БД
      const { response: firstResponse, duration: firstDuration } = await this.makeRequest(
        `${this.baseUrl}/api/internal/users/${userId}`,
        {
          headers: {
            'x-api-key': 'auth-service-staging-key-32chars',
            'x-internal-service': 'auth-service'
          }
        }
      );

      // Второй запрос - должен попасть в кэш
      const { response: secondResponse, duration: secondDuration } = await this.makeRequest(
        `${this.baseUrl}/api/internal/users/${userId}`,
        {
          headers: {
            'x-api-key': 'auth-service-staging-key-32chars',
            'x-internal-service': 'auth-service'
          }
        }
      );

      if (secondDuration < firstDuration * 0.8) {
        await this.addResult(
          'Redis Cache Performance',
          'PASS',
          `Кэширование работает (${firstDuration.toFixed(2)}ms -> ${secondDuration.toFixed(2)}ms)`,
          { cacheImprovement: `${((firstDuration - secondDuration) / firstDuration * 100).toFixed(1)}%` }
        );
      } else {
        await this.addResult(
          'Redis Cache Performance',
          'WARN',
          'Кэширование может работать неоптимально',
          { firstRequest: firstDuration, secondRequest: secondDuration }
        );
      }
    } catch ({ error, duration }) {
      await this.addResult(
        'Redis Cache Test',
        'FAIL',
        `Ошибка тестирования кэша: ${error.message}`,
        null,
        duration
      );
    }

    // Проверка статистики кэша
    try {
      const { response, duration } = await this.makeRequest(`${this.baseUrl}/api/cache/stats`, {
        headers: {
          'x-api-key': 'auth-service-staging-key-32chars',
          'x-internal-service': 'auth-service'
        }
      });

      const cacheStats = response.data.data;
      await this.addResult(
        'Redis Cache Stats',
        'PASS',
        'Статистика кэша получена',
        cacheStats,
        duration
      );
    } catch ({ error, duration }) {
      await this.addResult(
        'Redis Cache Stats',
        'WARN',
        'Статистика кэша недоступна',
        null,
        duration
      );
    }

    // Проверка подключения к PostgreSQL
    try {
      const { response, duration } = await this.makeRequest(`${this.baseUrl}/api/health`);
      const healthData = response.data;
      
      const dbStatus = healthData.info?.database?.status;
      if (dbStatus === 'up') {
        await this.addResult(
          'PostgreSQL Connection',
          'PASS',
          'Подключение к PostgreSQL активно',
          healthData.info.database,
          duration
        );
      } else {
        await this.addResult(
          'PostgreSQL Connection',
          'FAIL',
          'Проблемы с подключением к PostgreSQL',
          healthData.error?.database,
          duration
        );
      }
    } catch ({ error, duration }) {
      await this.addResult(
        'PostgreSQL Connection',
        'FAIL',
        `Ошибка проверки БД: ${error.message}`,
        null,
        duration
      );
    }
  }

  // 5. Валидация производительности и мониторинга
  async validatePerformanceAndMonitoring() {
    console.log('\n📊 Проверка производительности и мониторинга...\n');

    // Batch операции - тест производительности
    const batchUsers = Array.from({ length: 100 }, (_, i) => ({
      email: `batch-test-${Date.now()}-${i}@example.com`,
      password: 'hashed_password',
      name: `Batch Test User ${i}`
    }));

    try {
      const { response, duration } = await this.makeRequest(
        `${this.baseUrl}/api/internal/batch/users/create`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'auth-service-staging-key-32chars',
            'x-internal-service': 'auth-service'
          },
          data: { users: batchUsers }
        }
      );

      const throughput = batchUsers.length / (duration / 1000);
      if (throughput > 50) {
        await this.addResult(
          'Batch Operations Performance',
          'PASS',
          `Высокая производительность batch операций (${throughput.toFixed(1)} users/sec)`,
          { usersCreated: batchUsers.length, throughput },
          duration
        );
      } else {
        await this.addResult(
          'Batch Operations Performance',
          'WARN',
          `Низкая производительность batch операций (${throughput.toFixed(1)} users/sec)`,
          { usersCreated: batchUsers.length, throughput },
          duration
        );
      }
    } catch ({ error, duration }) {
      await this.addResult(
        'Batch Operations Performance',
        'FAIL',
        `Ошибка batch операций: ${error.message}`,
        null,
        duration
      );
    }

    // Проверка метрик производительности
    try {
      const { response, duration } = await this.makeRequest(`${this.baseUrl}/metrics`);
      const metricsText = response.data;
      
      const userMetrics = metricsText.split('\n').filter(line => 
        line.includes('user_operations_total') || 
        line.includes('user_cache_hits_total') ||
        line.includes('user_batch_operations_duration')
      );

      if (userMetrics.length > 0) {
        await this.addResult(
          'Performance Metrics',
          'PASS',
          'Метрики производительности доступны',
          { metricsFound: userMetrics.length },
          duration
        );
      } else {
        await this.addResult(
          'Performance Metrics',
          'WARN',
          'Метрики производительности не найдены',
          null,
          duration
        );
      }
    } catch ({ error, duration }) {
      await this.addResult(
        'Performance Metrics',
        'FAIL',
        `Ошибка получения метрик: ${error.message}`,
        null,
        duration
      );
    }

    // Проверка логирования
    try {
      const { response, duration } = await this.makeRequest(
        `${this.baseUrl}/api/internal/users/test-logging`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'auth-service-staging-key-32chars',
            'x-internal-service': 'auth-service'
          },
          data: { testMessage: 'Staging validation test' }
        }
      );

      await this.addResult(
        'Structured Logging',
        'PASS',
        'Структурированное логирование работает',
        null,
        duration
      );
    } catch ({ error, duration }) {
      if (error.response?.status === 404) {
        await this.addResult(
          'Structured Logging',
          'WARN',
          'Тестовый endpoint логирования не найден',
          null,
          duration
        );
      } else {
        await this.addResult(
          'Structured Logging',
          'FAIL',
          `Ошибка логирования: ${error.message}`,
          null,
          duration
        );
      }
    }
  }

  // Генерация отчета
  generateReport() {
    console.log('\n📋 ОТЧЕТ ВАЛИДАЦИИ STAGING ОКРУЖЕНИЯ\n');
    console.log('='.repeat(60));

    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const warnings = this.results.filter(r => r.status === 'WARN').length;
    const total = this.results.length;

    console.log(`\n📊 Общая статистика:`);
    console.log(`   ✅ Пройдено: ${passed}/${total}`);
    console.log(`   ❌ Провалено: ${failed}/${total}`);
    console.log(`   ⚠️  Предупреждения: ${warnings}/${total}`);

    const successRate = (passed / total * 100).toFixed(1);
    console.log(`   📈 Успешность: ${successRate}%`);

    if (failed > 0) {
      console.log(`\n❌ Критические ошибки:`);
      this.results
        .filter(r => r.status === 'FAIL')
        .forEach(r => console.log(`   - ${r.test}: ${r.message}`));
    }

    if (warnings > 0) {
      console.log(`\n⚠️  Предупреждения:`);
      this.results
        .filter(r => r.status === 'WARN')
        .forEach(r => console.log(`   - ${r.test}: ${r.message}`));
    }

    console.log('\n' + '='.repeat(60));

    if (failed === 0) {
      console.log('🎉 ВАЛИДАЦИЯ STAGING ОКРУЖЕНИЯ УСПЕШНО ЗАВЕРШЕНА!');
      console.log('✅ User Service готов к production деплою');
    } else {
      console.log('🚨 ВАЛИДАЦИЯ STAGING ОКРУЖЕНИЯ ПРОВАЛЕНА!');
      console.log('❌ Необходимо исправить критические ошибки перед production деплоем');
    }

    return {
      success: failed === 0,
      stats: { passed, failed, warnings, total, successRate: parseFloat(successRate) },
      results: this.results
    };
  }

  // Основной метод валидации
  async validate() {
    console.log('🚀 НАЧАЛО ВАЛИДАЦИИ USER SERVICE В STAGING ОКРУЖЕНИИ');
    console.log('=' .repeat(60));

    const deploymentOk = await this.validateDeployment();
    if (!deploymentOk) {
      console.log('\n❌ Критическая ошибка: сервис не развернут корректно');
      return this.generateReport();
    }

    const userId = await this.validateAuthServiceIntegration();
    if (userId) {
      await this.validateMicroservicesIntegration(userId);
    }

    await this.validateSharedInfrastructure();
    await this.validatePerformanceAndMonitoring();

    return this.generateReport();
  }
}

// Запуск валидации
async function main() {
  const baseUrl = process.env.USER_SERVICE_URL || 'http://localhost:3002';
  const validator = new StagingValidator(baseUrl);
  
  try {
    const result = await validator.validate();
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error('❌ Критическая ошибка валидации:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { StagingValidator };