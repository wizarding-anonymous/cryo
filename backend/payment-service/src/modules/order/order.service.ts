import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OrderNotFoundException } from '../../common/exceptions/order-not-found.exception';
import { GameCatalogIntegrationService } from '../../integrations/game-catalog/game-catalog.service';
import { Repository } from 'typeorm';
import { Order } from './entities/order.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { GetOrdersQueryDto } from './dto/get-orders-query.dto';
import { OrderStatus } from '../../common/enums/order-status.enum';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly gameCatalogService: GameCatalogIntegrationService,
  ) {}

  async createOrder(createOrderDto: CreateOrderDto, userId: string): Promise<Order> {
    const { gameId } = createOrderDto;

    // Step 1: Validate the game with the Game Catalog Service
    this.logger.log(`Validating game ${gameId} with Game Catalog Service.`);
    const gameInfo = await this.gameCatalogService.getGamePurchaseInfo(gameId);

    if (!gameInfo) {
      throw new BadRequestException(`Game with ID ${gameId} could not be found.`);
    }

    if (!gameInfo.available) {
      throw new BadRequestException(`Game '${gameInfo.title}' is not available for purchase.`);
    }

    // Step 2: Create the order with authoritative data
    const newOrder = this.orderRepository.create({
      userId,
      gameId,
      gameName: gameInfo.title,
      amount: gameInfo.price,
      currency: gameInfo.currency,
      status: OrderStatus.PENDING,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes expiry
    });

    this.logger.log(`Creating order for game '${gameInfo.title}' for user ${userId}.`);
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

  async getOrder(id: string, userId?: string): Promise<Order> {
    const whereClause: any = { id };
    if (userId) {
      whereClause.userId = userId;
    }
    const order = await this.orderRepository.findOne({ where: whereClause });
    if (!order) {
      throw new OrderNotFoundException(id);
    }
    return order;
  }

  async updateOrderStatus(id: string, status: OrderStatus): Promise<void> {
    await this.orderRepository.update(id, { status });
  }
}