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
    testTimeout: 10000,
    maxWorkers: 1, // Запуск тестов последовательно для избежания конфликтов
    verbose: true,
};