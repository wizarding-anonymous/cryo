const fs = require('fs');

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
    
    // Найти и заменить конструктор AuthService
    const authServiceRegex = /authService = new AuthService\(([\s\S]*?)\);/;
    const match = content.match(authServiceRegex);
    
    if (match) {
      const fullMatch = match[0];
      const parameters = match[1];
      
      // Очистить параметры от дублированных authMetrics и structuredLogger
      let cleanParameters = parameters
        .replace(/,\s*authMetrics/g, '')
        .replace(/,\s*structuredLogger/g, '')
        .replace(/authMetrics,?\s*/g, '')
        .replace(/structuredLogger,?\s*/g, '')
        .trim();
      
      // Убрать лишние запятые в конце
      cleanParameters = cleanParameters.replace(/,\s*$/, '');
      
      // Создать правильный конструктор
      const newConstructor = `authService = new AuthService(
${cleanParameters},
      authMetrics,
      structuredLogger
    );`;
      
      // Убрать старые моки если есть
      content = content.replace(/const authMetrics = \{[\s\S]*?\} as any;\s*/g, '');
      content = content.replace(/const structuredLogger = \{[\s\S]*?\} as any;\s*/g, '');
      
      // Добавить правильные моки перед конструктором
      const mocksCode = `
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
    } as any;

    // Создаем AuthService с моками
    `;
      
      // Заменить старый конструктор на новый с моками
      content = content.replace(fullMatch, mocksCode + newConstructor);
      
      // Записать файл
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Fixed: ${filePath}`);
    } else {
      console.log(`No AuthService constructor found in: ${filePath}`);
    }
  } else {
    console.log(`File not found: ${filePath}`);
  }
});

console.log('All test files fixed!');