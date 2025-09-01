const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

// Конфигурация для axios
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  validateStatus: function (status) {
    return status < 500; // Не бросать ошибку для статусов < 500
  }
});

// Цвета для консоли
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logTest(testName, status, details = '') {
  const statusColor = status === 'PASS' ? colors.green : colors.red;
  const statusIcon = status === 'PASS' ? '✅' : '❌';
  log(`${statusIcon} ${testName}`, statusColor);
  if (details) {
    log(`   ${details}`, colors.blue);
  }
}

// Глобальные переменные для тестов
let testUser = null;
let authToken = null;
let userId = null;

async function runTests() {
  log('\n🚀 Начинаем тестирование User Service эндпоинтов\n', colors.bold);

  try {
    // 1. Проверка health endpoint
    await testHealthEndpoint();
    
    // 2. Проверка API документации
    await testApiDocs();
    
    // 3. Тестирование регистрации пользователя
    await testUserRegistration();
    
    // 4. Тестирование аутентификации
    await testUserLogin();
    
    // 4.1. Тестирование активации (без токена, ожидаем ошибку)
    await testUserActivation();
    
    // 5. Тестирование профиля пользователя
    await testUserProfile();
    
    // 6. Тестирование ролей (требует админских прав)
    await testRoles();
    
    // 7. Тестирование метрик
    await testMetrics();
    
    // 8. Тестирование мониторинга интеграций
    await testIntegrationMonitoring();
    
    // 9. Тестирование кастомизации
    await testCustomization();
    
    // 10. Тестирование репутации
    await testReputation();

    log('\n🎉 Все тесты завершены!', colors.green + colors.bold);
    
  } catch (error) {
    log(`\n💥 Критическая ошибка: ${error.message}`, colors.red + colors.bold);
    process.exit(1);
  }
}

async function testHealthEndpoint() {
  try {
    const response = await api.get('/health');
    if (response.status === 200 && response.data.status === 'ok') {
      logTest('Health Check', 'PASS', `Status: ${response.data.status}`);
    } else {
      logTest('Health Check', 'FAIL', `Unexpected response: ${response.status}`);
    }
  } catch (error) {
    logTest('Health Check', 'FAIL', error.message);
  }
}

async function testApiDocs() {
  try {
    const response = await api.get('/api-docs');
    if (response.status === 200) {
      logTest('API Documentation', 'PASS', 'Swagger UI доступен');
    } else {
      logTest('API Documentation', 'FAIL', `Status: ${response.status}`);
    }
  } catch (error) {
    logTest('API Documentation', 'FAIL', error.message);
  }
}

async function testUserRegistration() {
  try {
    testUser = {
      email: `test.user.${Date.now()}@example.com`,
      username: `testuser${Date.now()}`,
      password: 'TestPassword123!',
      firstName: 'Тест',
      lastName: 'Пользователь'
    };

    const response = await api.post('/users/register', testUser);
    
    if (response.status === 201) {
      userId = response.data.user?.id;
      logTest('User Registration', 'PASS', `User ID: ${userId}`);
    } else {
      logTest('User Registration', 'FAIL', `Status: ${response.status}, Message: ${response.data?.message || 'Unknown error'}`);
    }
  } catch (error) {
    logTest('User Registration', 'FAIL', error.message);
  }
}

async function testUserLogin() {
  try {
    const loginData = {
      email: testUser.email,
      password: testUser.password
    };

    const response = await api.post('/auth/login', loginData);
    
    if (response.status === 200 && response.data.accessToken) {
      authToken = response.data.accessToken;
      // Настраиваем заголовок авторизации для последующих запросов
      api.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
      logTest('User Login', 'PASS', 'Access token получен');
    } else if (response.status === 401 && response.data?.message?.includes('inactive account')) {
      // Ожидаемое поведение для неактивированного пользователя
      logTest('User Login (Inactive Account)', 'PASS', 'Правильно блокирует неактивированных пользователей');
    } else {
      logTest('User Login', 'FAIL', `Status: ${response.status}, Message: ${response.data?.message || 'No access token'}`);
    }
  } catch (error) {
    logTest('User Login', 'FAIL', error.message);
  }
}

async function testUserActivation() {
  try {
    // Тестируем активацию с недействительным токеном (ожидаем ошибку)
    const response = await api.get('/auth/activate?token=invalid-token');
    
    if (response.status === 400) {
      logTest('User Activation (Invalid Token)', 'PASS', 'Правильно отклоняет недействительные токены');
    } else {
      logTest('User Activation (Invalid Token)', 'FAIL', `Unexpected status: ${response.status}`);
    }
  } catch (error) {
    logTest('User Activation (Invalid Token)', 'FAIL', error.message);
  }
}

async function testUserProfile() {
  try {
    if (!authToken) {
      logTest('User Profile Tests', 'SKIP', 'Нет токена авторизации (пользователь не активирован)');
      return;
    }

    // Тест настроек приватности
    const privacyData = {
      showEmail: false,
      showProfile: true
    };

    const privacyResponse = await api.put('/profile/settings/privacy', privacyData);
    
    if (privacyResponse.status === 200) {
      logTest('Update Privacy Settings', 'PASS', 'Настройки приватности обновлены');
    } else {
      logTest('Update Privacy Settings', 'FAIL', `Status: ${privacyResponse.status}`);
    }

    // Тест настроек уведомлений
    const notificationData = {
      emailNotifications: true,
      pushNotifications: false
    };

    const notificationResponse = await api.put('/profile/settings/notifications', notificationData);
    
    if (notificationResponse.status === 200) {
      logTest('Update Notification Settings', 'PASS', 'Настройки уведомлений обновлены');
    } else {
      logTest('Update Notification Settings', 'FAIL', `Status: ${notificationResponse.status}`);
    }
  } catch (error) {
    logTest('User Profile', 'FAIL', error.message);
  }
}

async function testRoles() {
  try {
    const response = await api.get('/admin/roles');
    
    // Ожидаем 403 или 401, так как у нас нет админских прав
    if (response.status === 403 || response.status === 401) {
      logTest('Roles Access Control', 'PASS', 'Доступ правильно ограничен');
    } else if (response.status === 200) {
      logTest('Roles Endpoint', 'PASS', `Найдено ролей: ${response.data?.length || 0}`);
    } else {
      logTest('Roles Endpoint', 'FAIL', `Unexpected status: ${response.status}`);
    }
  } catch (error) {
    logTest('Roles Endpoint', 'FAIL', error.message);
  }
}

async function testMetrics() {
  try {
    const response = await api.get('/metrics');
    
    if (response.status === 200) {
      logTest('Metrics Endpoint', 'PASS', 'Метрики доступны');
    } else {
      logTest('Metrics Endpoint', 'FAIL', `Status: ${response.status}`);
    }
  } catch (error) {
    logTest('Metrics Endpoint', 'FAIL', error.message);
  }
}

async function testIntegrationMonitoring() {
  try {
    const response = await api.get('/integration-monitoring/health');
    
    if (response.status === 200) {
      logTest('Integration Health', 'PASS', 'Статус интеграций получен');
    } else {
      logTest('Integration Health', 'FAIL', `Status: ${response.status}`);
    }
  } catch (error) {
    logTest('Integration Health', 'FAIL', error.message);
  }
}

async function testCustomization() {
  try {
    if (!authToken) {
      logTest('Customization Tests', 'SKIP', 'Нет токена авторизации (пользователь не активирован)');
      return;
    }

    const response = await api.get('/users/customization/me');
    
    if (response.status === 200) {
      logTest('Get Customization', 'PASS', 'Настройки кастомизации получены');
    } else {
      logTest('Get Customization', 'FAIL', `Status: ${response.status}`);
    }

    // Тест обновления кастомизации
    const customizationData = {
      theme: {
        primaryColor: '#ff6b6b',
        darkMode: true
      }
    };

    const updateResponse = await api.put('/users/customization/me', customizationData);
    
    if (updateResponse.status === 200) {
      logTest('Update Customization', 'PASS', 'Кастомизация обновлена');
    } else {
      logTest('Update Customization', 'FAIL', `Status: ${updateResponse.status}`);
    }
  } catch (error) {
    logTest('Customization', 'FAIL', error.message);
  }
}

async function testReputation() {
  try {
    if (!authToken) {
      logTest('Reputation Tests', 'SKIP', 'Нет токена авторизации (пользователь не активирован)');
      return;
    }

    const response = await api.get('/reputation/user');
    
    if (response.status === 200) {
      logTest('Get User Reputation', 'PASS', `Репутация: ${response.data?.reputation || 0}`);
    } else {
      logTest('Get User Reputation', 'FAIL', `Status: ${response.status}`);
    }

    // Тест получения топ пользователей
    const topResponse = await api.get('/reputation/top');
    
    if (topResponse.status === 200) {
      logTest('Get Top Users', 'PASS', `Топ пользователей получен`);
    } else {
      logTest('Get Top Users', 'FAIL', `Status: ${topResponse.status}`);
    }
  } catch (error) {
    logTest('Reputation', 'FAIL', error.message);
  }
}

// Запускаем тесты
runTests().catch(console.error);