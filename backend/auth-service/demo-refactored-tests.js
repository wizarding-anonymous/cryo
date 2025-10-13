#!/usr/bin/env node

/**
 * Демонстрационный скрипт для показа работы рефакторенных тестов
 * Запускает тесты с подробным выводом и объяснениями
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🎯 Демонстрация рефакторенных тестов Auth Service');
console.log('=' .repeat(60));
console.log('');

console.log('📋 Что было исправлено:');
console.log('  ✅ SagaModule - добавлен HttpClientModule');
console.log('  ✅ Создана тестовая конфигурация базы данных (SQLite в памяти)');
console.log('  ✅ Создан мок Redis сервиса без внешних зависимостей');
console.log('  ✅ Исправлена конфигурация ThrottlerModule');
console.log('  ✅ Улучшены моки внешних HTTP клиентов');
console.log('  ✅ Настроена изолированная тестовая среда');
console.log('  ✅ Созданы рефакторенные e2e и интеграционные тесты');
console.log('');

console.log('🧪 Тесты, которые будут запущены:');
console.log('  1. Token Validation Flow (16 тестов)');
console.log('  2. Complete User Registration Flow');
console.log('  3. Complete User Login Flow');
console.log('  4. Complete Logout Flow');
console.log('  5. Token Refresh Flow');
console.log('  6. Redis Integration Tests');
console.log('');

console.log('🏗️ Архитектурные особенности:');
console.log('  • Полная изоляция тестов (SQLite в памяти)');
console.log('  • Моки всех внешних сервисов (User, Security, Notification)');
console.log('  • Эмуляция общего Redis для микросервисов');
console.log('  • Автоматическая очистка после каждого теста');
console.log('  • Реалистичное поведение моков');
console.log('');

async function runDemo() {
  console.log('🚀 Запуск демонстрации...\n');

  try {
    // Запускаем основные рефакторенные тесты
    console.log('📊 Запуск Token Service тестов...');
    await runJest(['src/token/token.service.spec.ts'], 'jest.config.js', 'Token Service Unit Tests');

    console.log('\n🌐 Запуск E2E тестов аутентификации...');
    await runJest(['test/auth-flows-refactored.e2e-spec.ts'], 'test/jest-e2e.json', 'Authentication Flows E2E Tests');

    console.log('\n🔄 Запуск Redis интеграционных тестов...');
    await runJest(['test/redis-integration-refactored.spec.ts'], 'test/jest-e2e.json', 'Redis Integration Tests');

    console.log('\n' + '='.repeat(60));
    console.log('🎉 Демонстрация завершена успешно!');
    console.log('');
    console.log('📈 Результаты рефакторинга:');
    console.log('  ✅ Все рефакторенные тесты проходят');
    console.log('  ✅ Полная изоляция тестовой среды');
    console.log('  ✅ Нет зависимостей от внешних сервисов');
    console.log('  ✅ Быстрое выполнение тестов');
    console.log('  ✅ Стабильные и воспроизводимые результаты');
    console.log('');
    console.log('🔧 Для запуска всех рефакторенных тестов используйте:');
    console.log('  npm run test:refactored');
    console.log('');

  } catch (error) {
    console.error('\n❌ Ошибка во время демонстрации:', error.message);
    console.log('\n🔍 Возможные причины:');
    console.log('  • Не установлены зависимости (npm install)');
    console.log('  • Проблемы с TypeScript компиляцией');
    console.log('  • Отсутствуют файлы тестов');
    console.log('');
    console.log('💡 Попробуйте:');
    console.log('  1. npm install');
    console.log('  2. npm run build');
    console.log('  3. npm run test:refactored');
    process.exit(1);
  }
}

function runJest(testFiles, configFile, description) {
  return new Promise((resolve, reject) => {
    console.log(`\n📋 ${description}`);
    console.log('-'.repeat(40));

    const args = [
      '--config', configFile,
      '--verbose',
      '--runInBand',
      '--forceExit',
      '--no-coverage', // Отключаем покрытие для демо
      ...testFiles
    ];

    console.log(`🔧 Команда: npx jest ${args.join(' ')}`);
    console.log('');

    const jest = spawn('npx', ['jest', ...args], {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: 'test',
        IS_DEMO_TEST: 'true'
      }
    });

    jest.on('close', (code) => {
      if (code === 0) {
        console.log(`\n✅ ${description} - ПРОШЛИ УСПЕШНО`);
        resolve();
      } else {
        console.log(`\n❌ ${description} - ЗАВЕРШИЛИСЬ С ОШИБКОЙ (код: ${code})`);
        reject(new Error(`Jest exited with code ${code}`));
      }
    });

    jest.on('error', (error) => {
      console.error(`\n❌ Ошибка запуска Jest для ${description}: ${error.message}`);
      reject(error);
    });
  });
}

// Обработка сигналов
process.on('SIGINT', () => {
  console.log('\n\n⏹️  Демонстрация прервана пользователем');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n⏹️  Демонстрация завершена');
  process.exit(0);
});

// Обработка ошибок
process.on('unhandledRejection', (reason, promise) => {
  console.error('\n❌ Необработанная ошибка Promise:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('\n❌ Необработанное исключение:', error);
  process.exit(1);
});

// Запуск демонстрации
runDemo();