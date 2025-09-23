import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  UsePipes,
  ValidationPipe,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PaymentCacheInterceptor } from '../../common/interceptors/payment-cache.interceptor';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { OrderService } from './order.service';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CreateOrderDto } from './dto/create-order.dto';
import { GetOrdersQueryDto } from './dto/get-orders-query.dto';
import { Order } from './entities/order.entity';

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 orders per minute per user
  @UsePipes(ValidationPipe)
  @ApiOperation({
    summary: 'Create a new order',
    description:
      'Creates a new order for purchasing a game. Validates game availability and user authentication. Rate limited to 20 orders per minute.',
  })
  @ApiResponse({
    status: 201,
    description: 'The order has been successfully created.',
    type: Order,
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad Request. Invalid game ID, game not available, or validation errors.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized. Invalid or missing JWT token.',
  })
  @ApiResponse({ status: 404, description: 'Game not found in catalog.' })
  @ApiResponse({
    status: 429,
    description: 'Too Many Requests. Rate limit exceeded.',
  })
  create(@Body() createOrderDto: CreateOrderDto, @Request() req) {
    // Note: The JwtStrategy should place the user payload in req.user
    return this.orderService.createOrder(createOrderDto, req.user.userId);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all orders for the current user',
    description:
      'Retrieves paginated list of orders for the authenticated user with optional status filtering.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number for pagination (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of items per page (default: 10)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by order status',
  })
  @ApiResponse({
    status: 200,
    description: 'List of user orders with pagination metadata.',
    type: [Order],
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized. Invalid or missing JWT token.',
  })
  findAll(@Query() query: GetOrdersQueryDto, @Request() req) {
    return this.orderService.getUserOrders(query, req.user.userId);
  }

  @Get(':id')
  @UseInterceptors(PaymentCacheInterceptor)
  @ApiOperation({
    summary: 'Get a specific order for the current user',
    description:
      'Retrieves detailed information about a specific order. Only the order owner can access it. Results are cached for 5 minutes for performance.',
  })
  @ApiParam({ name: 'id', description: 'Order UUID' })
  @ApiResponse({ status: 200, description: 'The order details.', type: Order })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized. Invalid or missing JWT token.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. User does not own this order.',
  })
  @ApiResponse({ status: 404, description: 'Order not found.' })
  findOne(@Param('id') id: string, @Request() req) {
    return this.orderService.getOrder(id, req.user.userId);
  }
}
