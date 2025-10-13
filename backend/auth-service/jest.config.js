module.exports = {
    moduleFileExtensions: ['js', 'json', 'ts'],
    rootDir: 'src',
    testRegex: '.*\\.spec\\.ts$',
    transform: {
        '^.+\\.(t|j)s$': 'ts-jest',
    },
    collectCoverageFrom: [
        '**/*.(t|j)s',
        '!**/*.spec.ts',
        '!**/*.e2e-spec.ts',
        '!**/node_modules/**',
        '!**/test/**',
        '!**/dist/**',
    ],
    coverageDirectory: '../coverage',
    testEnvironment: 'node',
    moduleNameMapper: {
        '^src/(.*)$': '<rootDir>/$1',
    },
    setupFilesAfterEnv: ['<rootDir>/test/jest.setup.ts'],
    testTimeout: 15000,
    maxWorkers: 1, // Запуск тестов последовательно для избежания конфликтов
    verbose: true,
    // Игнорируем e2e тесты в unit тестах
    testPathIgnorePatterns: [
        '/node_modules/',
        '/dist/',
        '\\.e2e-spec\\.ts$',
        '/test/.*\\.e2e-spec\\.ts$'
    ],
};