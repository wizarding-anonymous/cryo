import { HttpStatus } from '@nestjs/common';
import { BaseHttpException, IErrorPayload } from './base-http.exception';

export class PaymentNotFoundException extends BaseHttpException {
  constructor(paymentId: string) {
    const payload: IErrorPayload = {
      code: 'PAYMENT_NOT_FOUND',
      message: `Payment with ID ${paymentId} not found`,
      details: { paymentId },
    };
    super(payload, HttpStatus.NOT_FOUND);
  }
}
