const fs = require('fs');
const path = require('path');

// Список файлов для обновления
const testFiles = [
  'src/auth/auth.service.atomic-logout.spec.ts',
  'src/auth/auth.service.login.spec.ts',
  'src/auth/auth.service.logout.spec.ts',
  'src/auth/auth.service.password.spec.ts',
  'src/auth/auth.service.race-condition.spec.ts',
  'src/auth/auth.service.refresh.spec.ts',
  'src/auth/auth.service.token.spec.ts',
  'src/auth/refresh-token.integration.spec.ts',
];

// Мок для AuthMetricsService
const authMetricsMock = `
    const authMetrics = {
      incrementAuthOperation: jest.fn(),
      recordAuthOperationDuration: jest.fn(),
      incrementActiveSessions: jest.fn(),
      decrementActiveSessions: jest.fn(),
      incrementAuthFailure: jest.fn(),
      incrementBlacklistedTokens: jest.fn(),
    } as any;`;

// Мок для StructuredLoggerService
const structuredLoggerMock = `
    const structuredLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      logAuth: jest.fn(),
      logSecurity: jest.fn(),
    } as any;`;

testFiles.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Найти место где создается AuthService
    const authServicePattern = /authService = new AuthService\(([\s\S]*?)\);/;
    const match = content.match(authServicePattern);
    
    if (match) {
      const originalConstructorCall = match[0];
      const parameters = match[1];
      
      // Добавить моки перед созданием AuthService
      const mocksToAdd = authMetricsMock + structuredLoggerMock;
      const newConstructorCall = originalConstructorCall.replace(
        parameters,
        parameters + ',\n      authMetrics,\n      structuredLogger,'
      );
      
      // Исправить синтаксис - убрать лишние запятые
      const fixedNewConstructorCall = newConstructorCall.replace(/,(\s*),/g, ',');
      
      // Заменить в содержимом файла
      content = content.replace(
        originalConstructorCall,
        mocksToAdd + '\n\n    // Создаем AuthService с моками\n    ' + fixedNewConstructorCall
      );
      
      // Записать обновленный файл
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated: ${filePath}`);
    } else {
      console.log(`No AuthService constructor found in: ${filePath}`);
    }
  } else {
    console.log(`File not found: ${filePath}`);
  }
});

console.log('All test files updated!');