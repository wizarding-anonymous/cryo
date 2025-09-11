import { Injectable } from '@nestjs/common';

@Injectable()
export class PaymentService {
  findAll() {
    return 'This action returns all payments';
  }
}