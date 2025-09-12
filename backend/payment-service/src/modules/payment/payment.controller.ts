import { Controller, Get, Post, Param, Body, Header, UseGuards, Request, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';

@ApiTags('Payments')
@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new payment for an order' })
  create(@Body() createPaymentDto: CreatePaymentDto, @Request() req) {
    return this.paymentService.createPayment(createPaymentDto, req.user.userId);
  }

  @Post(':id/process')
  @ApiOperation({ summary: 'Process a payment and get the payment URL' })
  process(@Param('id') id: string) {
    return this.paymentService.processPayment(id);
  }

  @Get(':id')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get payment details' })
  findOne(@Param('id') id: string) {
    return this.paymentService.getPayment(id);
  }

  @Post(':id/confirm')
  @ApiOperation({ summary: 'Confirm a payment (mock webhook)' })
  confirm(@Param('id') id: string) {
    return this.paymentService.confirmPayment(id);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a payment (mock webhook)' })
  cancel(@Param('id') id: string) {
    return this.paymentService.cancelPayment(id);
  }

  @Get(':id/mock-form')
  @ApiOperation({ summary: 'Get a mock HTML form to simulate payment' })
  @Header('Content-Type', 'text/html')
  getMockPaymentForm(@Param('id') id: string) {
    // This is a simplified mock form for testing purposes.
    // In a real application, this would be handled by the frontend.
    return `
      <html>
        <head><title>Mock Payment</title></head>
        <body>
          <h1>Mock Payment Page</h1>
          <p>Payment ID: ${id}</p>
          <button onclick="confirmPayment()">Confirm Payment</button>
          <button onclick="cancelPayment()">Cancel Payment</button>
          <script>
            async function confirmPayment() {
              await fetch('/payments/${id}/confirm', { method: 'POST' });
              alert('Payment Confirmed!');
            }
            async function cancelPayment() {
              await fetch('/payments/${id}/cancel', { method: 'POST' });
              alert('Payment Cancelled!');
            }
          </script>
        </body>
      </html>
    `;
  }
}