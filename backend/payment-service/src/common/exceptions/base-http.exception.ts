import { HttpException } from '@nestjs/common';

export interface IErrorPayload {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export class BaseHttpException extends HttpException {
  constructor(payload: IErrorPayload, statusCode: number) {
    super(payload, statusCode);
  }
}
