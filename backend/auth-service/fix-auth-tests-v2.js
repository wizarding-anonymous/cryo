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

testFiles.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Удалить дублированные моки если они есть
    content = content.replace(/const authMetrics = \{[\s\S]*?\} as any;\s*const structuredLogger = \{[\s\S]*?\} as any;\s*\/\/ Создаем AuthService с моками\s*/g, '');
    
    // Найти место где создается AuthService
    const authServicePattern = /authService = new AuthService\(([\s\S]*?)\);/;
    const match = content.match(authServicePattern);
    
    if (match) {
      const originalConstructorCall = match[0];
      const parameters = match[1].trim();
      
      // Убрать лишние запятые в конце
      const cleanParameters = parameters.replace(/,\s*$/, '');
      
      // Добавить новые параметры
      const newParameters = cleanParameters + ',\n      authMetrics,\n      structuredLogger';
      
      // Создать моки
      const mocksToAdd = `
    const authMetrics = {
      incrementAuthOperation: jest.fn(),
      recordAuthOperationDuration: jest.fn(),
      incrementActiveSessions: jest.fn(),
      decrementActiveSessions: jest.fn(),
      incrementAuthFailure: jest.fn(),
      incrementBlacklistedTokens: jest.fn(),
    } as any;

    const structuredLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      logAuth: jest.fn(),
      logSecurity: jest.fn(),
    } as any;`;
      
      const newConstructorCall = `authService = new AuthService(${newParameters}\n    );`;
      
      // Заменить в содержимом файла
      content = content.replace(
        originalConstructorCall,
        mocksToAdd + '\n\n    // Создаем AuthService с моками\n    ' + newConstructorCall
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