import { Test, TestingModule } from '@nestjs/testing';
import { SessionService } from './session.service';
import { SessionRepository } from '../repositories/session.repository';
import { Session } from '../entities/session.entity';

describe('SessionService - Concurrent Session Limiting', () => {
    let service: SessionService;
    let mockRepository: jest.Mocked<SessionRepository>;

    // Helper функция для создания полного Session объекта
    const createMockSession = (overrides: Partial<Session> = {}): Session => ({
        id: 'session-1',
        userId: 'user-123',
        accessTokenHash: 'hashed-access-token',
        refreshTokenHash: 'hashed-refresh-token',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        isActive: true,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 часа
        lastAccessedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    });

    beforeEach(async () => {
        // Создаем мок репозитория
        const mockSessionRepository = {
            findByUserId: jest.fn(),
            countActiveSessionsByUserId: jest.fn(),
            deactivateSession: jest.fn(),
            deactivateAllUserSessions: jest.fn(),
            findById: jest.fn(),
        };

        // Создаем моки для зависимостей
        const mockRedisLockService = {
            acquireLock: jest.fn().mockResolvedValue(true),
            releaseLock: jest.fn().mockResolvedValue(true),
            withLock: jest.fn().mockImplementation(async (_key, fn) => fn()),
            isLocked: jest.fn().mockResolvedValue(false),
        };

        const mockRaceConditionMetricsService = {
            recordMetric: jest.fn(),
            getMetrics: jest.fn().mockReturnValue({}),
        };

        const mockTokenService = {
            generateTokens: jest.fn(),
            validateToken: jest.fn(),
            blacklistToken: jest.fn(),
            hashToken: jest.fn().mockReturnValue('hashed-token'),
        };

        mockRepository = {
            findActiveSessionsByUserId: jest.fn(),
            findByUserId: jest.fn(),
            countActiveSessionsByUserId: jest.fn(),
            deactivateSession: jest.fn(),
            deactivateAllUserSessions: jest.fn(),
            remove: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
            findOne: jest.fn(),
        } as any;

        service = new SessionService(
            mockRepository,
            mockRedisLockService as any,
            mockRaceConditionMetricsService as any,
            mockTokenService as any
        );
    });

    describe('enforceSessionLimit', () => {
        it('should remove oldest sessions when limit is exceeded', async () => {
            // Arrange: 6 сессий, лимит 5
            const mockSessions = [
                createMockSession({
                    id: 'session-1',
                    createdAt: new Date('2025-01-01T10:00:00Z'),
                    lastAccessedAt: new Date('2025-01-01T10:30:00Z'),
                }),
                createMockSession({
                    id: 'session-2',
                    createdAt: new Date('2025-01-01T11:00:00Z'),
                    lastAccessedAt: null, // Никогда не использовалась
                }),
                createMockSession({
                    id: 'session-3',
                    createdAt: new Date('2025-01-01T12:00:00Z'),
                    lastAccessedAt: new Date('2025-01-01T12:15:00Z'),
                }),
                createMockSession({
                    id: 'session-4',
                    createdAt: new Date('2025-01-01T13:00:00Z'),
                    lastAccessedAt: new Date('2025-01-01T13:45:00Z'),
                }),
                createMockSession({
                    id: 'session-5',
                    createdAt: new Date('2025-01-01T14:00:00Z'),
                    lastAccessedAt: new Date('2025-01-01T14:30:00Z'),
                }),
                createMockSession({
                    id: 'session-6',
                    createdAt: new Date('2025-01-01T15:00:00Z'),
                    lastAccessedAt: new Date('2025-01-01T15:10:00Z'),
                }),
            ];

            mockRepository.findByUserId.mockResolvedValue(mockSessions);
            mockRepository.deactivateSession.mockResolvedValue(undefined);

            // Act
            const removedCount = await service.enforceSessionLimit('user-123', 5);

            // Assert
            expect(removedCount).toBe(2); // Должно удалить 2 сессии (6 - 5 + 1)
            expect(mockRepository.deactivateSession).toHaveBeenCalledTimes(2);

            // Проверяем, что удалились самые старые сессии (по lastAccessedAt или createdAt)
            expect(mockRepository.deactivateSession).toHaveBeenCalledWith('session-1');
            expect(mockRepository.deactivateSession).toHaveBeenCalledWith('session-2');
        });

        it('should not remove sessions when under limit', async () => {
            // Arrange: 3 сессии, лимит 5
            const mockSessions = [
                createMockSession({ id: 'session-1' }),
                createMockSession({ id: 'session-2' }),
                createMockSession({ id: 'session-3' }),
            ];

            mockRepository.findByUserId.mockResolvedValue(mockSessions);

            // Act
            const removedCount = await service.enforceSessionLimit('user-123', 5);

            // Assert
            expect(removedCount).toBe(0);
            expect(mockRepository.deactivateSession).not.toHaveBeenCalled();
        });

        it('should handle empty sessions array', async () => {
            // Arrange
            mockRepository.findByUserId.mockResolvedValue([]);

            // Act
            const removedCount = await service.enforceSessionLimit('user-123', 5);

            // Assert
            expect(removedCount).toBe(0);
            expect(mockRepository.deactivateSession).not.toHaveBeenCalled();
        });
    });

    describe('getConcurrentSessionInfo', () => {
        it('should return correct session information', async () => {
            // Arrange
            const mockSessions = [
                createMockSession({
                    id: 'session-1',
                    createdAt: new Date(Date.now() - 1000 * 60 * 60), // 1 час назад
                    lastAccessedAt: new Date(Date.now() - 1000 * 60 * 30), // 30 минут назад
                }),
                createMockSession({
                    id: 'session-2',
                    createdAt: new Date(Date.now() - 1000 * 60 * 30), // 30 минут назад
                    lastAccessedAt: null, // Никогда не использовалась
                }),
                createMockSession({
                    id: 'session-3',
                    createdAt: new Date(Date.now() - 1000 * 60 * 10), // 10 минут назад
                    lastAccessedAt: new Date(Date.now() - 1000 * 60 * 5), // 5 минут назад
                }),
            ];

            mockRepository.countActiveSessionsByUserId.mockResolvedValue(3);
            mockRepository.findByUserId.mockResolvedValue(mockSessions);

            // Act
            const info = await service.getConcurrentSessionInfo('user-123', 5);

            // Assert
            expect(info.currentSessionCount).toBe(3);
            expect(info.maxAllowedSessions).toBe(5);
            expect(info.isAtLimit).toBe(false);
            expect(info.canCreateNewSession).toBe(true);
            expect(info.sessionsUntilLimit).toBe(2);
            expect(info.oldestSessionAge).toBeGreaterThan(0);
        });

        it('should handle user at session limit', async () => {
            // Arrange
            mockRepository.countActiveSessionsByUserId.mockResolvedValue(5);
            mockRepository.findByUserId.mockResolvedValue([
                createMockSession({ id: 'session-1' }),
                createMockSession({ id: 'session-2' }),
                createMockSession({ id: 'session-3' }),
                createMockSession({ id: 'session-4' }),
                createMockSession({ id: 'session-5' }),
            ]);

            // Act
            const info = await service.getConcurrentSessionInfo('user-123', 5);

            // Assert
            expect(info.currentSessionCount).toBe(5);
            expect(info.maxAllowedSessions).toBe(5);
            expect(info.isAtLimit).toBe(true);
            expect(info.canCreateNewSession).toBe(false);
            expect(info.sessionsUntilLimit).toBe(0);
        });

        it('should handle user with no sessions', async () => {
            // Arrange
            mockRepository.countActiveSessionsByUserId.mockResolvedValue(0);
            mockRepository.findByUserId.mockResolvedValue([]);

            // Act
            const info = await service.getConcurrentSessionInfo('user-123', 5);

            // Assert
            expect(info.currentSessionCount).toBe(0);
            expect(info.maxAllowedSessions).toBe(5);
            expect(info.isAtLimit).toBe(false);
            expect(info.canCreateNewSession).toBe(true);
            expect(info.sessionsUntilLimit).toBe(5);
            expect(info.oldestSessionAge).toBeNull();
        });
    });

    describe('invalidateSessionsForSecurityEvent', () => {
        it('should invalidate all sessions except excluded one', async () => {
            // Arrange
            const mockSessions = [
                createMockSession({ id: 'session-1' }),
                createMockSession({ id: 'session-2' }),
                createMockSession({ id: 'session-3' }),
            ];

            mockRepository.findByUserId.mockResolvedValue(mockSessions);
            mockRepository.deactivateSession.mockResolvedValue(undefined);

            // Act
            const result = await service.invalidateSessionsForSecurityEvent(
                'user-123',
                'password_change',
                'session-2' // Исключаем эту сессию
            );

            // Assert
            expect(result.invalidatedCount).toBe(2);
            expect(result.remainingCount).toBe(1);
            expect(result.securityEventType).toBe('password_change');
            expect(mockRepository.deactivateSession).toHaveBeenCalledTimes(2);
            expect(mockRepository.deactivateSession).toHaveBeenCalledWith('session-1');
            expect(mockRepository.deactivateSession).toHaveBeenCalledWith('session-3');
            expect(mockRepository.deactivateSession).not.toHaveBeenCalledWith('session-2');
        });

        it('should invalidate all sessions when no exclusion', async () => {
            // Arrange
            const mockSessions = [
                createMockSession({ id: 'session-1' }),
                createMockSession({ id: 'session-2' }),
            ];

            mockRepository.findByUserId.mockResolvedValue(mockSessions);
            mockRepository.deactivateAllUserSessions.mockResolvedValue(undefined);

            // Act
            const result = await service.invalidateSessionsForSecurityEvent(
                'user-123',
                'account_compromise'
            );

            // Assert
            expect(result.invalidatedCount).toBe(2);
            expect(result.remainingCount).toBe(0);
            expect(result.securityEventType).toBe('account_compromise');
            expect(mockRepository.deactivateAllUserSessions).toHaveBeenCalledWith('user-123');
        });

        it('should handle different security event types', async () => {
            // Arrange
            mockRepository.findByUserId.mockResolvedValue([]);
            mockRepository.deactivateAllUserSessions.mockResolvedValue(undefined);

            // Act & Assert для каждого типа события
            const eventTypes: Array<'password_change' | 'suspicious_activity' | 'account_compromise' | 'admin_action'> = [
                'password_change',
                'suspicious_activity',
                'account_compromise',
                'admin_action'
            ];

            for (const eventType of eventTypes) {
                const result = await service.invalidateSessionsForSecurityEvent('user-123', eventType);
                expect(result.securityEventType).toBe(eventType);
            }
        });
    });

    describe('invalidateAllUserSessions', () => {
        it('should invalidate all user sessions and return count', async () => {
            // Arrange
            const mockSessions = [
                createMockSession({ id: 'session-1' }),
                createMockSession({ id: 'session-2' }),
                createMockSession({ id: 'session-3' }),
            ];

            mockRepository.findByUserId.mockResolvedValue(mockSessions);
            mockRepository.deactivateAllUserSessions.mockResolvedValue(undefined);

            // Act
            const count = await service.invalidateAllUserSessions('user-123', 'security_breach');

            // Assert
            expect(count).toBe(3);
            expect(mockRepository.deactivateAllUserSessions).toHaveBeenCalledWith('user-123');
        });

        it('should handle user with no sessions', async () => {
            // Arrange
            mockRepository.findByUserId.mockResolvedValue([]);
            mockRepository.deactivateAllUserSessions.mockResolvedValue(undefined);

            // Act
            const count = await service.invalidateAllUserSessions('user-123');

            // Assert
            expect(count).toBe(0);
            expect(mockRepository.deactivateAllUserSessions).toHaveBeenCalledWith('user-123');
        });

        it('should handle undefined sessions array', async () => {
            // Arrange
            mockRepository.findByUserId.mockResolvedValue(undefined);
            mockRepository.deactivateAllUserSessions.mockResolvedValue(undefined);

            // Act
            const count = await service.invalidateAllUserSessions('user-123');

            // Assert
            expect(count).toBe(0);
            expect(mockRepository.deactivateAllUserSessions).toHaveBeenCalledWith('user-123');
        });
    });

    describe('Edge Cases', () => {
        it('should handle repository errors gracefully', async () => {
            // Arrange
            mockRepository.findByUserId.mockRejectedValue(new Error('Database error'));

            // Act & Assert
            await expect(service.enforceSessionLimit('user-123', 5)).rejects.toThrow('Database error');
        });

        it('should handle session limit of 0', async () => {
            // Arrange
            const mockSessions = [
                createMockSession({ id: 'session-1' }),
            ];

            mockRepository.findByUserId.mockResolvedValue(mockSessions);
            mockRepository.deactivateSession.mockResolvedValue(undefined);

            // Act
            const removedCount = await service.enforceSessionLimit('user-123', 0);

            // Assert
            expect(removedCount).toBe(1); // Должна удалить единственную сессию
            expect(mockRepository.deactivateSession).toHaveBeenCalledWith('session-1');
        });

        it('should handle negative session limit', async () => {
            // Arrange
            const mockSessions = [
                createMockSession({ id: 'session-1' }),
            ];

            mockRepository.findByUserId.mockResolvedValue(mockSessions);
            mockRepository.deactivateSession.mockResolvedValue(undefined);

            // Act
            const removedCount = await service.enforceSessionLimit('user-123', -1);

            // Assert
            expect(removedCount).toBe(1); // Должна удалить все сессии
        });
    });
});