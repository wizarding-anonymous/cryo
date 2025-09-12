import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PurchaseHistory } from './entities/purchase-history.entity';
import { HistoryQueryDto, SearchHistoryDto } from './dto/request.dto';
import { HistoryResponseDto } from './dto/response.dto';
import { AddGameToLibraryDto } from '../library/dto/request.dto'; // Re-using for purchase record creation

@Injectable()
export class HistoryService {
  constructor(
    @InjectRepository(PurchaseHistory)
    private readonly historyRepository: Repository<PurchaseHistory>,
  ) {}

  async getPurchaseHistory(
    userId: string,
    queryDto: HistoryQueryDto,
  ): Promise<HistoryResponseDto> {
    const [history, total] = await this.historyRepository.findAndCount({
      where: { userId },
      skip: (queryDto.page - 1) * queryDto.limit,
      take: queryDto.limit,
      order: { [queryDto.sortBy]: queryDto.sortOrder },
    });

    return {
      history: history, // Will be mapped to DTOs
      pagination: {
        total,
        page: queryDto.page,
        limit: queryDto.limit,
        totalPages: Math.ceil(total / queryDto.limit),
      },
    };
  }

  async getPurchaseDetails(
    userId: string,
    purchaseId: string,
  ): Promise<PurchaseHistory> {
    const purchase = await this.historyRepository.findOne({
      where: { id: purchaseId, userId },
    });

    if (!purchase) {
      throw new NotFoundException(`Purchase with ID ${purchaseId} not found.`);
    }
    return purchase;
  }

  // This DTO is not specified in design.md but is needed for this method.
  // I will use AddGameToLibraryDto as it contains all the necessary fields.
  async createPurchaseRecord(
    dto: AddGameToLibraryDto,
  ): Promise<PurchaseHistory> {
    const newRecord = this.historyRepository.create({
      id: dto.purchaseId,
      userId: dto.userId,
      gameId: dto.gameId,
      orderId: dto.orderId,
      amount: dto.purchasePrice,
      currency: dto.currency,
      // other fields like paymentMethod could be added
    });
    return this.historyRepository.save(newRecord);
  }

  async searchPurchaseHistory(
    userId: string,
    searchDto: SearchHistoryDto,
  ): Promise<HistoryResponseDto> {
    // Similar to SearchService, a full-text search would be more complex.
    // This is a placeholder for a more advanced search.
    // For now, we will just return the normal paginated history.
    return this.getPurchaseHistory(userId, searchDto);
  }
}
