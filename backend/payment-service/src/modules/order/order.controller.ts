import { Controller, Get, Post, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { OrderService } from './order.service';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CreateOrderDto } from './dto/create-order.dto';
import { GetOrdersQueryDto } from './dto/get-orders-query.dto';

@ApiTags('Orders')
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new order' })
  create(@Body() createOrderDto: CreateOrderDto, @Request() req) {
    return this.orderService.createOrder(createOrderDto, req.user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all orders for the current user' })
  findAll(@Query() query: GetOrdersQueryDto, @Request() req) {
    return this.orderService.getUserOrders(query, req.user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific order for the current user' })
  findOne(@Param('id') id: string, @Request() req) {
    return this.orderService.getOrder(id, req.user.userId);
  }
}