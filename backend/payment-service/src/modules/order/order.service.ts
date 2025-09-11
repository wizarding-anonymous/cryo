import { Injectable } from '@nestjs/common';

@Injectable()
export class OrderService {
  findAll() {
    return 'This action returns all orders';
  }
}