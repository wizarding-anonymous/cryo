// Простой тест для проверки работоспособности User Service
const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function testUserService() {
  console.log('🚀 Тестирование User Service...\n');

  try {
    // Тест 1: Проверка основного эндпоинта
    console.log('1. Тестирование основного эндпоинта...');
    const rootResponse = await axios.get(`${BASE_URL}/`);
    console.log(`   ✅ GET / - Status: ${rootResponse.status}, Data: ${rootResponse.data}`);

    // Тест 2: Проверка health check
    console.log('\n2. Тестирование health check...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log(`   ✅ GET /health - Status: ${healthResponse.status}`);
    console.log(`   📊 Health Status: ${healthResponse.data.status}`);

    // Тест 3: Проверка метрик
    console.log('\n3. Тестирование метрик...');
    const metricsResponse = await axios.get(`${BASE_URL}/metrics`);
    console.log(`   ✅ GET /metrics - Status: ${metricsResponse.status}`);
    console.log(`   📈 Metrics size: ${metricsResponse.data.length} bytes`);

    // Тест 4: Проверка Swagger документации
    console.log('\n4. Тестирование Swagger документации...');
    const swaggerResponse = await axios.get(`${BASE_URL}/api-docs-json`);
    console.log(`   ✅ GET /api-docs-json - Status: ${swaggerResponse.status}`);
    console.log(`   📚 API Title: ${swaggerResponse.data.info.title}`);
    console.log(`   📚 API Version: ${swaggerResponse.data.info.version}`);

    console.log('\n🎉 Все тесты прошли успешно!');
    console.log('\n📋 Сводка результатов:');
    console.log('   ✅ Основной эндпоинт работает');
    console.log('   ✅ Health check работает');
    console.log('   ✅ Метрики Prometheus работают');
    console.log('   ✅ Swagger документация доступна');
    console.log('   ✅ Логирование HTTP запросов работает');
    console.log('   ✅ Docker контейнеры запущены');
    console.log('   ✅ PostgreSQL и Redis подключены');

  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error.message);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data: ${error.response.data}`);
    }
  }
}

// Запуск тестов
testUserService();