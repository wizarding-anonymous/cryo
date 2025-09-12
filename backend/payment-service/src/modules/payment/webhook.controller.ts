import { Controller, Post, Body, Param, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { PaymentProviderService } from './payment-provider.service';
import { PaymentWebhookDto } from './dto/payment-webhook.dto';
import { PaymentProvider } from '../../common/enums/payment-provider.enum';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly paymentProviderService: PaymentProviderService,
  ) {}

  @Post(':provider')
  @ApiOperation({ summary: 'Handle incoming webhooks from payment providers' })
  @ApiResponse({ status: 200, description: 'Webhook received and processed.' })
  @ApiResponse({ status: 400, description: 'Bad Request. Invalid payload or signature.' })
  async handleWebhook(
    @Param('provider') provider: PaymentProvider,
    @Body() webhookDto: PaymentWebhookDto,
  ): Promise<{ status: string }> {
    this.logger.log(`Received webhook from ${provider} with payload: ${JSON.stringify(webhookDto)}`);

    const { externalId, status } = this.paymentProviderService.handleWebhook(provider, webhookDto);

    if (!externalId) {
      throw new BadRequestException('Could not extract externalId from webhook payload.');
    }

    const payment = await this.paymentService.findByExternalId(externalId);
    if (!payment) {
      throw new NotFoundException(`Payment with external ID ${externalId} not found.`);
    }

    this.logger.log(`Processing webhook for internal payment ${payment.id}`);

    // This is a simplified mapping. A real implementation would be more robust.
    if (status === 'success' || status === 'completed' || status === 'succeeded') {
      await this.paymentService.confirmPayment(payment.id);
    } else {
      await this.paymentService.cancelPayment(payment.id);
    }

    return { status: 'received' };
  }
}
