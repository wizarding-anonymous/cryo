import { HttpStatus } from '@nestjs/common';
import { BaseHttpException, IErrorPayload } from './base-http.exception';

export class OrderNotFoundException extends BaseHttpException {
  constructor(orderId: string) {
    const payload: IErrorPayload = {
      code: 'ORDER_NOT_FOUND',
      message: `Order with ID ${orderId} not found`,
      details: { orderId },
    };
    super(payload, HttpStatus.NOT_FOUND);
  }
}
