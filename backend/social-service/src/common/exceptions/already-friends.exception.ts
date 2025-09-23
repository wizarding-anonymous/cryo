import { HttpException, HttpStatus } from '@nestjs/common';

export class AlreadyFriendsException extends HttpException {
  constructor() {
    super(
      {
        error: 'ALREADY_FRIENDS',
        message: `Users are already friends`,
        statusCode: HttpStatus.CONFLICT,
      },
      HttpStatus.CONFLICT,
    );
  }
}
