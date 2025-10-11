import { Injectable, NotFoundException } from '@nestjs/common';
import {
  PurchaseHistory,
  PurchaseStatus,
} from '../entities/purchase-history.entity';
import {
  HistoryQueryDto,
  SearchHistoryDto,
  HistoryResponseDto,
  PurchaseDetailsDto,
} from './dto';
import { AddGameToLibraryDto, GameDetailsDto } from '../library/dto';
import { HistorySortBy } from '../common/enums';
import { PurchaseHistoryRepository } from './repositories/purchase-history.repository';
import { GameCatalogClient } from '../clients/game-catalog.client';

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
    const page = queryDto.page ?? 1;
    const limit = queryDto.limit ?? 20;

    const [history, total] = await this.historyRepository.findUserHistory(
      userId,
      {
        ...queryDto,
        page,
        limit,
        sortBy: queryDto.sortBy ?? HistorySortBy.CREATED_AT,
        sortOrder: queryDto.sortOrder ?? 'desc',
      },
    );

    const items = history.map((item) => PurchaseDetailsDto.fromEntity(item));
    const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;

    return {
      history: items,
      pagination: {
        total,
        page,
        limit,
        totalPages,
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
      status: PurchaseStatus.COMPLETED, // Default to completed status
      paymentMethod: 'card',
    });
    return this.historyRepository.save(newRecord);
  }

  async searchPurchaseHistory(
    userId: string,
    searchDto: SearchHistoryDto,
  ): Promise<HistoryResponseDto> {
    const page = searchDto.page ?? 1;
    const limit = searchDto.limit ?? 20;

    const allHistory = await this.historyRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    if (allHistory.length === 0) {
      return {
        history: [],
        pagination: { total: 0, page, limit, totalPages: 0 },
      };
    }

    const gameIds = [...new Set(allHistory.map((item) => item.gameId))];
    const gameDetails = await this.gameCatalogClient.getGamesByIds(gameIds);
    const gameDetailsMap = new Map<string, GameDetailsDto>();
    gameDetails.forEach((detail) => gameDetailsMap.set(detail.id, detail));

    // Enhanced search with fuzzy matching and multiple field support
    const normalizedQuery = this.normalizeSearchQuery(searchDto.query);
    const scoredHistory = allHistory
      .map((item) => ({
        item,
        score: this.computePurchaseHistoryScore(
          normalizedQuery,
          item,
          gameDetailsMap.get(item.gameId),
        ),
      }))
      .filter((entry) => entry.score >= 0.3) // Use fuzzy matching threshold
      .sort((a, b) => b.score - a.score);

    // If no matches found with fuzzy search, fall back to basic search for backward compatibility
    let filteredHistory = scoredHistory.map((entry) => entry.item);
    if (filteredHistory.length === 0) {
      filteredHistory = allHistory.filter((item) => {
        const details = gameDetailsMap.get(item.gameId);
        return details?.title?.toLowerCase().includes(normalizedQuery) ?? false;
      });
    }

    const total = filteredHistory.length;
    const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
    const startIndex = (page - 1) * limit;
    const paginatedHistory = filteredHistory.slice(
      startIndex,
      startIndex + limit,
    );
    const items = paginatedHistory.map((item) =>
      PurchaseDetailsDto.fromEntity(item),
    );

    return {
      history: items,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  /**
   * Normalize search query for consistent matching
   */
  private normalizeSearchQuery(query: string): string {
    return query.toLowerCase().trim();
  }

  /**
   * Compute relevance score for purchase history items
   * Supports searching by game title, developer, and purchase metadata
   */
  private computePurchaseHistoryScore(
    query: string,
    historyItem: PurchaseHistory,
    gameDetails?: GameDetailsDto,
  ): number {
    let maxScore = 0;

    // Search in game details if available
    if (gameDetails) {
      // Title matching (highest priority)
      if (gameDetails.title) {
        const titleScore = this.computeFieldMatchScore(
          query,
          gameDetails.title.toLowerCase(),
        );
        maxScore = Math.max(maxScore, titleScore * 1.0);
      }

      // Developer matching
      if (gameDetails.developer) {
        const devScore = this.computeFieldMatchScore(
          query,
          gameDetails.developer.toLowerCase(),
        );
        maxScore = Math.max(maxScore, devScore * 0.8);
      }

      // Publisher matching
      if (gameDetails.publisher) {
        const pubScore = this.computeFieldMatchScore(
          query,
          gameDetails.publisher.toLowerCase(),
        );
        maxScore = Math.max(maxScore, pubScore * 0.6);
      }

      // Tags matching
      if (Array.isArray(gameDetails.tags)) {
        for (const tag of gameDetails.tags) {
          const tagScore = this.computeFieldMatchScore(
            query,
            tag.toLowerCase(),
          );
          maxScore = Math.max(maxScore, tagScore * 0.7);
        }
      }
    }

    // Search in purchase metadata
    if (
      historyItem.paymentMethod &&
      historyItem.paymentMethod.toLowerCase().includes(query)
    ) {
      maxScore = Math.max(maxScore, 0.6);
    }

    if (
      historyItem.currency &&
      historyItem.currency.toLowerCase().includes(query)
    ) {
      maxScore = Math.max(maxScore, 0.5);
    }

    return maxScore;
  }

  /**
   * Compute field match score with fuzzy matching support
   */
  private computeFieldMatchScore(query: string, fieldValue: string): number {
    if (!fieldValue || !query) return 0;

    // Exact match
    if (fieldValue === query) return 1.0;

    // Substring match
    if (fieldValue.includes(query)) {
      if (fieldValue.startsWith(query)) return 0.95;
      return 0.85;
    }

    // Word boundary matches
    const words = fieldValue.split(/\s+/);
    for (const word of words) {
      if (word === query) return 0.9;
      if (word.startsWith(query)) return 0.8;
    }

    // Simple fuzzy matching using Levenshtein-like approach
    const similarity = this.computeSimilarity(fieldValue, query);
    return similarity >= 0.6 ? similarity * 0.7 : similarity;
  }

  /**
   * Simple similarity calculation for fuzzy matching
   */
  private computeSimilarity(a: string, b: string): number {
    if (!a || !b) return 0;
    if (a === b) return 1;

    const maxLength = Math.max(a.length, b.length);
    const minLength = Math.min(a.length, b.length);

    // Quick length-based filtering
    if (maxLength - minLength > maxLength * 0.5) return 0;

    // Count matching characters
    let matches = 0;
    const aChars = a.split('');
    const bChars = b.split('');

    for (let i = 0; i < minLength; i++) {
      if (aChars[i] === bChars[i]) matches++;
    }

    return matches / maxLength;
  }
}
