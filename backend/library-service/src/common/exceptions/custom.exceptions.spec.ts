import { HttpStatus } from '@nestjs/common';
import {
    GameNotOwnedException,
    LibraryNotFoundException,
    DuplicateGameException,
    PurchaseNotFoundException,
} from './custom.exceptions';

describe('Custom Exceptions', () => {
    describe('GameNotOwnedException', () => {
        it('should create exception with correct message and status', () => {
            const userId = 'user123';
            const gameId = 'game456';
            const exception = new GameNotOwnedException(userId, gameId);

            expect(exception.getStatus()).toBe(HttpStatus.FORBIDDEN);
            expect(exception.getResponse()).toEqual({
                error: 'GAME_NOT_OWNED',
                message: `User ${userId} does not own game ${gameId}`,
                statusCode: HttpStatus.FORBIDDEN,
            });
        });
    });

    describe('LibraryNotFoundException', () => {
        it('should create exception with correct message and status', () => {
            const userId = 'user123';
            const exception = new LibraryNotFoundException(userId);

            expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
            expect(exception.getResponse()).toEqual({
                error: 'LIBRARY_NOT_FOUND',
                message: `Library not found for user ${userId}`,
                statusCode: HttpStatus.NOT_FOUND,
            });
        });
    });

    describe('DuplicateGameException', () => {
        it('should create exception with correct message and status', () => {
            const userId = 'user123';
            const gameId = 'game456';
            const exception = new DuplicateGameException(userId, gameId);

            expect(exception.getStatus()).toBe(HttpStatus.CONFLICT);
            expect(exception.getResponse()).toEqual({
                error: 'DUPLICATE_GAME',
                message: `Game ${gameId} already exists in user ${userId} library`,
                statusCode: HttpStatus.CONFLICT,
            });
        });
    });

    describe('PurchaseNotFoundException', () => {
        it('should create exception with correct message and status', () => {
            const purchaseId = 'purchase123';
            const exception = new PurchaseNotFoundException(purchaseId);

            expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
            expect(exception.getResponse()).toEqual({
                error: 'PURCHASE_NOT_FOUND',
                message: `Purchase ${purchaseId} not found`,
                statusCode: HttpStatus.NOT_FOUND,
            });
        });
    });
});