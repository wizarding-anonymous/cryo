// Глобальная настройка для Jest тестов

// Мокирование bcrypt для всех тестов
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashedPassword123'),
  compare: jest.fn().mockResolvedValue(true),
  genSalt: jest.fn().mockResolvedValue('salt'),
}));

// Мокирование crypto для консистентности
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomBytes: jest.fn().mockReturnValue(Buffer.from('mockedRandomBytes')),
  createHash: jest.fn().mockReturnValue({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn().mockReturnValue('mockedHash'),
  }),
}));

// Глобальные настройки для тестов
beforeEach(() => {
  // Очистка всех моков перед каждым тестом
  jest.clearAllMocks();
  
  // Сброс системного времени
  jest.clearAllTimers();
  
  // Настройка консоли для тестов
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  // Восстановление моков консоли
  jest.restoreAllMocks();
});

// Глобальные утилиты для тестов
global.mockDate = (date: string | Date) => {
  const mockDate = new Date(date);
  jest.spyOn(Date, 'now').mockReturnValue(mockDate.getTime());
  jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);
};

global.restoreDate = () => {
  jest.restoreAllMocks();
};