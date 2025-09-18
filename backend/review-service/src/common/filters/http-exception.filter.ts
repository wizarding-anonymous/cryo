import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

// A mapping from NestJS default error messages to our custom error codes
const messageToCodeMapping: Record<string, string> = {
  'You must own the game to leave a review.': 'GAME_OWNERSHIP_ERROR',
  'You have already reviewed this game.': 'DUPLICATE_REVIEW_ERROR',
  'You are not allowed to edit this review': 'FORBIDDEN_ERROR',
  'You are not allowed to delete this review': 'FORBIDDEN_ERROR',
};

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    let message = exception.message;
    let code = 'GENERIC_ERROR';

    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const res = exceptionResponse as { message: string | string[] };
      message = Array.isArray(res.message) ? res.message.join(', ') : res.message;
    }

    // Determine error code
    code = messageToCodeMapping[message] || 'UNKNOWN_ERROR';

    if (code === 'UNKNOWN_ERROR') {
        switch (status) {
            case HttpStatus.BAD_REQUEST:
              code = 'VALIDATION_ERROR';
              break;
            case HttpStatus.UNAUTHORIZED:
              code = 'UNAUTHORIZED_ERROR';
              break;
            case HttpStatus.FORBIDDEN:
              code = 'FORBIDDEN_ERROR';
              break;
            case HttpStatus.NOT_FOUND:
              code = 'NOT_FOUND_ERROR';
              break;
            case HttpStatus.CONFLICT:
              code = 'CONFLICT_ERROR';
              break;
            default:
              code = 'INTERNAL_SERVER_ERROR';
        }
    }

    response.status(status).json({
      error: {
        code: code,
        message: message,
        timestamp: new Date().toISOString(),
        path: request.url,
        details: {}, // Details can be populated if needed in the future
      },
    });
  }
}
