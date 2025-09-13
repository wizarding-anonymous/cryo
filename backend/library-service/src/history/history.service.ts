import { Injectable, NotFoundException } from '@nestjs/common';
import { PurchaseHistory } from './entities/purchase-history.entity';
import { HistoryQueryDto, SearchHistoryDto } from './dto/request.dto';
import { HistoryResponseDto } from './dto/response.dto';
import { AddGameToLibraryDto } from '../library/dto/request.dto';
import { PurchaseHistoryRepository } from './repositories/purchase-history.repository';
import { GameCatalogClient } from '../clients/game-catalog.client';
import { GameDetailsDto } from '../library/dto/response.dto';

@Injectable()
export class HistoryService {
  constructor(
    private readonly historyRepository: PurchaseHistoryRepository,
    private readonly gameCatalogClient: GameCatalogClient,
  ) {}

  async getPurchaseHistory(
    userId: string,
    queryDto: HistoryQueryDto,
  ): Promise<HistoryResponseDto> {
    const [history, total] = await this.historyRepository.findUserHistory(
      userId,
      queryDto,
    );

    return {
      history: history, // In a real app, this would be mapped to a DTO
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
      paymentMethod: 'card', // Placeholder
    });
    return this.historyRepository.save(newRecord);
  }

  async searchPurchaseHistory(
    userId: string,
    searchDto: SearchHistoryDto,
  ): Promise<HistoryResponseDto> {
    const allHistory = await this.historyRepository.find({ where: { userId } });
    if (allHistory.length === 0) {
      return { history: [], pagination: { total: 0, page: 1, limit: searchDto.limit, totalPages: 0 } };
    }

    const gameIds = [...new Set(allHistory.map((item) => item.gameId))];
    const gameDetails = await this.gameCatalogClient.getGamesByIds(gameIds);
    const gameDetailsMap = new Map<string, GameDetailsDto>();
    gameDetails.forEach((detail) => gameDetailsMap.set(detail.id, detail));

    const query = searchDto.query.toLowerCase();
    const filteredHistory = allHistory.filter((item) => {
      const details = gameDetailsMap.get(item.gameId);
      if (!details) return false;
      return details.title.toLowerCase().includes(query);
    });

    const total = filteredHistory.length;
    const page = searchDto.page || 1;
    const limit = searchDto.limit || 10;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const paginatedHistory = filteredHistory.slice(startIndex, startIndex + limit);

    return {
      history: paginatedHistory,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }
}
