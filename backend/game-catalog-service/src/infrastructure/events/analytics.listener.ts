import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { AnalyticsService } from '../../application/services/analytics.service';

interface SaleCompletedPayload {
    gameId: string;
    amount: number;
    userId: string;
    timestamp: string;
}

interface DownloadStartedPayload {
    gameId: string;
    userId: string;
    timestamp: string;
}

interface SearchPerformedPayload {
    query: string;
    resultCount: number;
    userId?: string;
    timestamp: string;
}

@Controller()
export class AnalyticsListener {
    private readonly logger = new Logger(AnalyticsListener.name);

    constructor(private readonly analyticsService: AnalyticsService) {}

    @EventPattern('sale.completed')
    async handleSaleCompleted(@Payload() data: SaleCompletedPayload) {
        this.logger.log(`Received 'sale.completed' event for game ${data.gameId}`);
        await this.analyticsService.trackSale(data.gameId, data.amount);
    }

    @EventPattern('download.started')
    async handleDownloadStarted(@Payload() data: DownloadStartedPayload) {
        this.logger.log(`Received 'download.started' event for game ${data.gameId}`);
        await this.analyticsService.trackDownload(data.gameId);
    }

    @EventPattern('search.performed')
    async handleSearchPerformed(@Payload() data: SearchPerformedPayload) {
        this.logger.log(`Received 'search.performed' event for query: ${data.query}`);
        await this.analyticsService.trackSearchQuery(data.query, data.resultCount);
    }
}
