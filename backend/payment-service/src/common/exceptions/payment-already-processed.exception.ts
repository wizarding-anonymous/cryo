import { HttpStatus } from '@nestjs/common';
import { BaseHttpException, IErrorPayload } from './base-http.exception';

export class PaymentAlreadyProcessedException extends BaseHttpException {
  constructor(paymentId: string) {
    const payload: IErrorPayload = {
      code: 'PAYMENT_ALREADY_PROCESSED',
      message: `Payment with ID ${paymentId} has already been processed.`,
      details: { paymentId },
    };
    super(payload, HttpStatus.CONFLICT);
  }
}
