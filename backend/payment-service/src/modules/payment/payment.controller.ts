import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
  UseInterceptors,
} from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
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
  @ApiOperation({ summary: 'Create a new payment for an order' })
  @ApiResponse({
    status: 201,
    description: 'The payment has been successfully created.',
    type: Payment,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Order not found.' })
  create(@Body() createPaymentDto: CreatePaymentDto, @Request() req) {
    return this.paymentService.createPayment(createPaymentDto, req.user.userId);
  }

  @Post(':id/process')
  @ApiOperation({ summary: 'Process a payment and get the payment URL' })
  @ApiResponse({
    status: 201,
    description: 'Returns the URL for the payment provider.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Payment not found.' })
  @ApiResponse({
    status: 409,
    description: 'Payment has been already processed.',
  })
  process(@Param('id') id: string) {
    return this.paymentService.processPayment(id);
  }

  @Get(':id')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get payment details' })
  @ApiResponse({
    status: 200,
    description: 'The payment details.',
    type: Payment,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Payment not found.' })
  findOne(@Param('id') id: string) {
    return this.paymentService.getPayment(id);
  }

  @Post(':id/confirm')
  @ApiOperation({ summary: 'Confirm a payment (webhook endpoint)' })
  @ApiResponse({
    status: 200,
    description: 'Payment has been successfully confirmed.',
    type: Payment,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Payment not found.' })
  @ApiResponse({
    status: 409,
    description: 'Payment is already confirmed or cannot be confirmed.',
  })
  confirm(@Param('id') id: string) {
    return this.paymentService.confirmPayment(id);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a payment' })
  @ApiResponse({
    status: 200,
    description: 'Payment has been successfully cancelled.',
    type: Payment,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Payment not found.' })
  @ApiResponse({
    status: 409,
    description: 'Payment cannot be cancelled (already processed).',
  })
  cancel(@Param('id') id: string) {
    return this.paymentService.cancelPayment(id);
  }
}
