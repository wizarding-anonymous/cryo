import { HttpException, HttpStatus } from '@nestjs/common';

export class MessageNotFoundException extends HttpException {
  constructor(messageId: string) {
    super(
      {
        error: 'MESSAGE_NOT_FOUND',
        message: `Message ${messageId} not found`,
        statusCode: HttpStatus.NOT_FOUND,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}
