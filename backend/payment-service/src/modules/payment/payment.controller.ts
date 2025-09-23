import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PaymentCacheInterceptor } from '../../common/interceptors/payment-cache.interceptor';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Payment } from './entities/payment.entity';

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 payments per minute per user
  @UsePipes(ValidationPipe)
  @ApiOperation({
    summary: 'Create a new payment for an order',
    description:
      'Creates a payment for an existing order with the specified payment provider (Sberbank, YMoney, or TBank). Rate limited to 10 payments per minute.',
  })
  @ApiResponse({
    status: 201,
    description: 'The payment has been successfully created.',
    type: Payment,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request. Invalid order ID or validation errors.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized. Invalid or missing JWT token.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. User does not own the order.',
  })
  @ApiResponse({ status: 404, description: 'Order not found.' })
  @ApiResponse({
    status: 409,
    description: 'Conflict. Payment already exists for this order.',
  })
  @ApiResponse({
    status: 429,
    description: 'Too Many Requests. Rate limit exceeded.',
  })
  create(@Body() createPaymentDto: CreatePaymentDto, @Request() req) {
    return this.paymentService.createPayment(createPaymentDto, req.user.userId);
  }

  @Post(':id/process')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 payment processes per minute per user
  @ApiOperation({
    summary: 'Process a payment and get the payment URL',
    description:
      'Initiates payment processing with the selected provider and returns the payment URL for user redirection. Rate limited to 5 processes per minute.',
  })
  @ApiParam({ name: 'id', description: 'Payment UUID' })
  @ApiResponse({
    status: 201,
    description:
      'Returns the URL for the payment provider and external payment ID.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized. Invalid or missing JWT token.',
  })
  @ApiResponse({ status: 404, description: 'Payment not found.' })
  @ApiResponse({
    status: 409,
    description: 'Conflict. Payment has already been processed.',
  })
  @ApiResponse({
    status: 429,
    description: 'Too Many Requests. Rate limit exceeded.',
  })
  process(@Param('id') id: string) {
    return this.paymentService.processPayment(id);
  }

  @Get(':id')
  @UseInterceptors(PaymentCacheInterceptor)
  @ApiOperation({
    summary: 'Get payment details',
    description:
      'Retrieves detailed information about a payment including status, provider, and transaction details. Results are cached for 2 minutes for performance.',
  })
  @ApiParam({ name: 'id', description: 'Payment UUID' })
  @ApiResponse({
    status: 200,
    description:
      'The payment details with current status and provider information.',
    type: Payment,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized. Invalid or missing JWT token.',
  })
  @ApiResponse({ status: 404, description: 'Payment not found.' })
  findOne(@Param('id') id: string) {
    return this.paymentService.getPayment(id);
  }

  @Post(':id/confirm')
  @ApiOperation({
    summary: 'Confirm a payment',
    description:
      'Confirms a successful payment, updates order status, and triggers game addition to user library. Typically called by payment provider webhooks.',
  })
  @ApiParam({ name: 'id', description: 'Payment UUID' })
  @ApiResponse({
    status: 200,
    description:
      'Payment has been successfully confirmed and game added to library.',
    type: Payment,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized. Invalid or missing JWT token.',
  })
  @ApiResponse({ status: 404, description: 'Payment not found.' })
  @ApiResponse({
    status: 409,
    description:
      'Conflict. Payment is already confirmed or cannot be confirmed.',
  })
  confirm(@Param('id') id: string) {
    return this.paymentService.confirmPayment(id);
  }

  @Post(':id/cancel')
  @ApiOperation({
    summary: 'Cancel a payment',
    description:
      'Cancels a pending payment and updates the order status. Cannot cancel already processed payments.',
  })
  @ApiParam({ name: 'id', description: 'Payment UUID' })
  @ApiResponse({
    status: 200,
    description: 'Payment has been successfully cancelled.',
    type: Payment,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized. Invalid or missing JWT token.',
  })
  @ApiResponse({ status: 404, description: 'Payment not found.' })
  @ApiResponse({
    status: 409,
    description:
      'Conflict. Payment cannot be cancelled (already processed or completed).',
  })
  cancel(@Param('id') id: string) {
    return this.paymentService.cancelPayment(id);
  }
}
