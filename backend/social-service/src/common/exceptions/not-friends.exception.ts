import { HttpException, HttpStatus } from '@nestjs/common';

export class NotFriendsException extends HttpException {
  constructor() {
    super(
      {
        error: 'NOT_FRIENDS',
        message: `Users are not friends`,
        statusCode: HttpStatus.FORBIDDEN,
      },
      HttpStatus.FORBIDDEN,
    );
  }
}
