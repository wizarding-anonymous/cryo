import { HttpException, HttpStatus } from '@nestjs/common';

export class FriendRequestNotFoundException extends HttpException {
  constructor(requestId: string) {
    super(
      {
        error: 'FRIEND_REQUEST_NOT_FOUND',
        message: `Friend request ${requestId} not found`,
        statusCode: HttpStatus.NOT_FOUND,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}
