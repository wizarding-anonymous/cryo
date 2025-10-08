import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Render,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PaymentService } from './payment.service';

@ApiTags('Mock Payment Forms')
@Controller('mock')
export class MockFormsController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get('sberbank/payment-form/:paymentId')
  @ApiOperation({ summary: 'Mock Sberbank Online payment form' })
  @Render('mock-sberbank-form')
  async showSberbankForm(
    @Param('paymentId') paymentId: string,
    @Query('externalId') externalId: string,
  ) {
    const payment = await this.paymentService.getPayment(paymentId);
    return {
      paymentId: payment.id,
      orderId: payment.orderId,
      amount: payment.amount,
      externalId,
      provider: 'Сбербанк Онлайн',
      actionUrl: `/mock/sberbank/process/${paymentId}`,
    };
  }

  @Get('ymoney/payment-form/:paymentId')
  @ApiOperation({ summary: 'Mock YMoney payment form' })
  @Render('mock-ymoney-form')
  async showYMoneyForm(
    @Param('paymentId') paymentId: string,
    @Query('externalId') externalId: string,
  ) {
    const payment = await this.paymentService.getPayment(paymentId);
    return {
      paymentId: payment.id,
      orderId: payment.orderId,
      amount: payment.amount,
      externalId,
      provider: 'ЮMoney',
      actionUrl: `/mock/ymoney/process/${paymentId}`,
    };
  }

  @Get('tbank/payment-form/:paymentId')
  @ApiOperation({ summary: 'Mock T-Bank payment form' })
  @Render('mock-tbank-form')
  async showTBankForm(
    @Param('paymentId') paymentId: string,
    @Query('externalId') externalId: string,
  ) {
    const payment = await this.paymentService.getPayment(paymentId);
    return {
      paymentId: payment.id,
      orderId: payment.orderId,
      amount: payment.amount,
      externalId,
      provider: 'Т-Банк',
      actionUrl: `/mock/tbank/process/${paymentId}`,
    };
  }

  @Post('sberbank/process/:paymentId')
  @ApiOperation({ summary: 'Process mock Sberbank payment' })
  async processSberbankPayment(
    @Param('paymentId') paymentId: string,
    @Body() body: { action: string; externalId: string },
  ) {
    if (body.action === 'confirm') {
      // Simulate successful payment
      await this.paymentService.confirmPayment(paymentId);
      return { redirect: `/mock/payment/success/${paymentId}` };
    } else {
      // Simulate cancelled payment
      await this.paymentService.cancelPayment(paymentId);
      return { redirect: `/mock/payment/failure/${paymentId}` };
    }
  }

  @Post('ymoney/process/:paymentId')
  @ApiOperation({ summary: 'Process mock YMoney payment' })
  async processYMoneyPayment(
    @Param('paymentId') paymentId: string,
    @Body() body: { action: string; externalId: string },
  ) {
    if (body.action === 'confirm') {
      await this.paymentService.confirmPayment(paymentId);
      return { redirect: `/mock/payment/success/${paymentId}` };
    } else {
      await this.paymentService.cancelPayment(paymentId);
      return { redirect: `/mock/payment/failure/${paymentId}` };
    }
  }

  @Post('tbank/process/:paymentId')
  @ApiOperation({ summary: 'Process mock T-Bank payment' })
  async processTBankPayment(
    @Param('paymentId') paymentId: string,
    @Body() body: { action: string; externalId: string },
  ) {
    if (body.action === 'confirm') {
      await this.paymentService.confirmPayment(paymentId);
      return { redirect: `/mock/payment/success/${paymentId}` };
    } else {
      await this.paymentService.cancelPayment(paymentId);
      return { redirect: `/mock/payment/failure/${paymentId}` };
    }
  }
}
