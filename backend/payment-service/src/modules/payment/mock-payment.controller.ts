import { Controller, Get, Param, Render } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PaymentService } from './payment.service';

@ApiTags('Mock UI')
@Controller('mock/payment')
export class MockPaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get('success/:paymentId')
  @ApiOperation({ summary: 'Mock page for a successful payment' })
  @Render('mock-payment-success')
  async showSuccessPage(@Param('paymentId') paymentId: string) {
    const payment = await this.paymentService.getPayment(paymentId);
    return {
      paymentId: payment.id,
      orderId: payment.orderId,
      amount: payment.amount,
      provider: payment.provider,
    };
  }

  @Get('failure/:paymentId')
  @ApiOperation({ summary: 'Mock page for a failed payment' })
  @Render('mock-payment-failure')
  async showFailurePage(@Param('paymentId') paymentId: string) {
    const payment = await this.paymentService.getPayment(paymentId);
    return {
      paymentId: payment.id,
      orderId: payment.orderId,
      error: 'The payment was declined by the provider.',
    };
  }
}
