import { Controller, Get, Post, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'Create a new order' })
  @ApiResponse({ status: 201, description: 'The order has been successfully created.', type: Order })
  @ApiResponse({ status: 400, description: 'Bad Request. Invalid game ID or game not available.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  create(@Body() createOrderDto: CreateOrderDto, @Request() req) {
    // Note: The JwtStrategy should place the user payload in req.user
    return this.orderService.createOrder(createOrderDto, req.user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all orders for the current user' })
  @ApiResponse({ status: 200, description: 'List of user orders.', type: [Order] })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  findAll(@Query() query: GetOrdersQueryDto, @Request() req) {
    return this.orderService.getUserOrders(query, req.user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific order for the current user' })
  @ApiResponse({ status: 200, description: 'The order details.', type: Order })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Order not found.' })
  findOne(@Param('id') id: string, @Request() req) {
    return this.orderService.getOrder(id, req.user.userId);
  }
}