#!/usr/bin/env node

/**
 * Скрипт для запуска рефакторенных тестов
 * Запускает только новые, исправленные тесты
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Запуск рефакторенных тестов Auth Service...\n');

// Определяем тесты для запуска
const refactoredTests = [
  // E2E тесты
  'test/auth-flows-refactored.e2e-spec.ts',
  'test/redis-integration-refactored.spec.ts',
  
  // Unit тесты (основные)
  'src/token/token.service.spec.ts',
  'src/auth/auth.service.login.spec.ts',
  'src/auth/auth.service.logout.spec.ts',
  'src/auth/auth.service.register.spec.ts',
  'src/auth/auth.service.refresh.spec.ts',
  'src/session/session.service.spec.ts',
];

async function runTests() {
  console.log('📋 Запускаемые тесты:');
  refactoredTests.forEach(test => console.log(`  - ${test}`));
  console.log('');

  // Запускаем unit тесты
  console.log('🧪 Запуск unit тестов...');
  const unitTests = refactoredTests.filter(test => test.startsWith('src/'));
  
  if (unitTests.length > 0) {
    await runJest(unitTests, 'jest.config.js');
  }

  // Запускаем e2e тесты
  console.log('\n🌐 Запуск e2e тестов...');
  const e2eTests = refactoredTests.filter(test => test.startsWith('test/'));
  
  if (e2eTests.length > 0) {
    await runJest(e2eTests, 'test/jest-e2e.json');
  }

  console.log('\n✅ Все рефакторенные тесты завершены!');
}

function runJest(testFiles, configFile) {
  return new Promise((resolve, reject) => {
    const args = [
      '--config', configFile,
      '--verbose',
      '--runInBand', // Запуск последовательно
      '--forceExit', // Принудительное завершение
      '--detectOpenHandles', // Обнаружение открытых хендлов
      ...testFiles
    ];

    console.log(`Команда: npx jest ${args.join(' ')}`);

    const jest = spawn('npx', ['jest', ...args], {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: 'test',
        IS_REFACTORED_TEST: 'true'
      }
    });

    jest.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ Тесты с конфигом ${configFile} прошли успешно`);
        resolve();
      } else {
        console.log(`❌ Тесты с конфигом ${configFile} завершились с ошибкой (код: ${code})`);
        reject(new Error(`Jest exited with code ${code}`));
      }
    });

    jest.on('error', (error) => {
      console.error(`❌ Ошибка запуска Jest: ${error.message}`);
      reject(error);
    });
  });
}

// Обработка ошибок
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Необработанная ошибка Promise:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Необработанное исключение:', error);
  process.exit(1);
});

// Запуск
runTests().catch((error) => {
  console.error('❌ Ошибка выполнения тестов:', error.message);
  process.exit(1);
});