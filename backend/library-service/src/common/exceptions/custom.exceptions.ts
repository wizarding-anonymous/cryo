import { HttpException, HttpStatus } from '@nestjs/common';

export class GameNotOwnedException extends HttpException {
  constructor(userId: string, gameId: string) {
    super(
      {
        error: 'GAME_NOT_OWNED',
        message: `User ${userId} does not own game ${gameId}`,
        statusCode: HttpStatus.FORBIDDEN,
      },
      HttpStatus.FORBIDDEN,
    );
  }
}

export class LibraryNotFoundException extends HttpException {
  constructor(userId: string) {
    super(
      {
        error: 'LIBRARY_NOT_FOUND',
        message: `Library not found for user ${userId}`,
        statusCode: HttpStatus.NOT_FOUND,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class DuplicateGameException extends HttpException {
  constructor(userId: string, gameId: string) {
    super(
      {
        error: 'DUPLICATE_GAME',
        message: `Game ${gameId} already exists in user ${userId} library`,
        statusCode: HttpStatus.CONFLICT,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class PurchaseNotFoundException extends HttpException {
  constructor(purchaseId: string) {
    super(
      {
        error: 'PURCHASE_NOT_FOUND',
        message: `Purchase ${purchaseId} not found`,
        statusCode: HttpStatus.NOT_FOUND,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}
