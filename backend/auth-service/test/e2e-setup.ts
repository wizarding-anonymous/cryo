// Глобальная настройка для E2E тестов

// Увеличиваем таймаут для e2e тестов
jest.setTimeout(30000);

// АРХИТЕКТУРНОЕ ИСПРАВЛЕНИЕ: Убираем глобальные моки, которые нарушают NestJS DI
// Моки bcrypt и crypto будут применяться локально в тестах, где это необходимо
// Глобальные моки базовых Node.js модулей могут нарушить работу фреймворка

// Если нужно мокировать bcrypt или crypto, делайте это в конкретных тестах:
// jest.mock('bcrypt', () => ({ ... })) - внутри describe блока

// Глобальные настройки для e2e тестов
beforeEach(() => {
  // Очистка всех моков перед каждым тестом
  jest.clearAllMocks();
  
  // НЕ подавляем логи консоли, так как это может влиять на NestJS DI
  // jest.spyOn(console, 'error').mockImplementation(() => {});
  // jest.spyOn(console, 'warn').mockImplementation(() => {});
  // jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  // Восстановление моков консоли (только если они были замокированы)
  // jest.restoreAllMocks();
});

// Глобальные утилиты для e2e тестов
global.mockDate = (date: string | Date) => {
  const mockDate = new Date(date);
  jest.spyOn(Date, 'now').mockReturnValue(mockDate.getTime());
  jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);
};

global.restoreDate = () => {
  jest.restoreAllMocks();
};

// Утилиты для генерации тестовых данных
global.generateTestEmail = () => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `test-${timestamp}-${random}@example.com`;
};

global.generateTestPassword = () => {
  const random = Math.random().toString(36).substring(2, 8);
  return `TestPass${random}!`;
};

global.generateTestUser = () => ({
  name: 'Test User',
  email: global.generateTestEmail(),
  password: global.generateTestPassword(),
});

// Обработка необработанных промисов в тестах
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// Экспорт для превращения файла в модуль
export {};

// Расширение глобальных типов для TypeScript
declare global {
  var mockDate: (date: string | Date) => void;
  var restoreDate: () => void;
  var generateTestEmail: () => string;
  var generateTestPassword: () => string;
  var generateTestUser: () => { name: string; email: string; password: string };
}