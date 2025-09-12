import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from './entities/order.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { GetOrdersQueryDto } from './dto/get-orders-query.dto';
import { OrderStatus } from '../../common/enums/order-status.enum';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  async createOrder(createOrderDto: CreateOrderDto, userId: string): Promise<Order> {
    const { gameId, gameName, amount } = createOrderDto;

    const newOrder = this.orderRepository.create({
      userId,
      gameId,
      gameName,
      amount,
      currency: 'RUB',
      status: OrderStatus.PENDING,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    return this.orderRepository.save(newOrder);
  }

  async getUserOrders(
    query: GetOrdersQueryDto,
    userId: string,
  ): Promise<{ data: Order[]; total: number }> {
    const { page = 1, limit = 10, status } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.orderRepository.createQueryBuilder('order');
    queryBuilder.where('order.userId = :userId', { userId });

    if (status) {
      queryBuilder.andWhere('order.status = :status', { status });
    }

    queryBuilder.orderBy('order.createdAt', 'DESC');
    queryBuilder.skip(skip).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return { data, total };
  }

  async getOrder(id: string, userId: string): Promise<Order> {
    const order = await this.orderRepository.findOne({ where: { id, userId } });
    if (!order) {
      throw new NotFoundException(`Order with ID #${id} not found for this user.`);
    }
    return order;
  }

  async updateOrderStatus(id: string, status: OrderStatus): Promise<void> {
    await this.orderRepository.update(id, { status });
  }
}