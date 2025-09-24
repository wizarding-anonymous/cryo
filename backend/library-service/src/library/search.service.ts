import { Injectable } from '@nestjs/common';
import { LibraryRepository } from './repositories/library.repository';
import {
  SearchLibraryDto,
  LibraryResponseDto,
  LibraryGameDto,
  GameDetailsDto,
} from './dto';
import { GameCatalogClient } from '../clients/game-catalog.client';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class SearchService {
  constructor(
    private readonly libraryRepository: LibraryRepository,
    private readonly gameCatalogClient: GameCatalogClient,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Enhanced search with full-text capabilities, fuzzy matching, and optimized caching
   * Supports search by title, developer, publisher, and tags with advanced scoring
   */
  async searchUserLibrary(
    userId: string,
    searchDto: SearchLibraryDto,
  ): Promise<LibraryResponseDto> {
    const page = searchDto.page ?? 1;
    const limit = searchDto.limit ?? 20;
    const query = normalize(searchDto.query);

    // Enhanced cache key with query normalization
    const cacheKey = `search_library_v2_${userId}_page_${page}_limit_${limit}_q_${createSearchHash(query)}`;

    const fetchFn = async (): Promise<LibraryResponseDto> => {
      // First try database-level full-text search for better performance
      const [dbResults, dbTotal] =
        await this.libraryRepository.fullTextSearchLibrary(userId, query, {
          page,
          limit,
          sortBy: searchDto.sortBy,
          sortOrder: searchDto.sortOrder,
        });

      // If database search returns results, use them as base
      let libraryGames = dbResults;

      // If no database results or we want comprehensive search, get all user games
      if (libraryGames.length === 0) {
        libraryGames = await this.libraryRepository.find({
          where: { userId },
        });
      }

      if (libraryGames.length === 0) {
        return {
          games: [],
          pagination: { total: 0, page, limit, totalPages: 0 },
        };
      }

      // Get game details for enrichment
      const gameIds = libraryGames.map((game) => game.gameId);
      const gameDetails = await this.gameCatalogClient.getGamesByIds(gameIds);
      const gameDetailsMap = new Map<string, GameDetailsDto>();
      gameDetails.forEach((detail) => gameDetailsMap.set(detail.id, detail));

      // Enrich games with details
      const enrichedLibraryGames = libraryGames.map((game) =>
        LibraryGameDto.fromEntity(game, gameDetailsMap.get(game.gameId)),
      );

      // Apply advanced search scoring with fuzzy matching
      const scoredGames = enrichedLibraryGames
        .map((game) => ({
          game,
          score: this.computeAdvancedMatchScore(query, game.gameDetails),
        }))
        .filter((entry) => entry.score >= 0.3) // Lower threshold for fuzzy matching
        .sort((a, b) => b.score - a.score);

      // Apply pagination to scored results
      const total = scoredGames.length;
      const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
      const startIndex = (page - 1) * limit;
      const paginatedGames = scoredGames
        .slice(startIndex, startIndex + limit)
        .map((entry) => entry.game);

      return {
        games: paginatedGames,
        pagination: {
          total,
          page,
          limit,
          totalPages,
        },
      };
    };

    return await this.cacheService.getCachedSearchResults<LibraryResponseDto>(
      userId,
      cacheKey,
      fetchFn,
    );
  }

  /**
   * Advanced search by specific fields (title, developer, tags)
   * Provides more targeted search capabilities
   */
  async searchByField(
    userId: string,
    field: 'title' | 'developer' | 'publisher' | 'tags',
    query: string,
    options: { page?: number; limit?: number } = {},
  ): Promise<LibraryResponseDto> {
    const page = options.page ?? 1;
    const limit = options.limit ?? 20;
    const normalizedQuery = normalize(query);

    const cacheKey = `search_field_${field}_${userId}_page_${page}_limit_${limit}_q_${createSearchHash(normalizedQuery)}`;

    const fetchFn = async (): Promise<LibraryResponseDto> => {
      const allLibraryGames = await this.libraryRepository.find({
        where: { userId },
      });

      if (allLibraryGames.length === 0) {
        return {
          games: [],
          pagination: { total: 0, page, limit, totalPages: 0 },
        };
      }

      const gameIds = allLibraryGames.map((game) => game.gameId);
      const gameDetails = await this.gameCatalogClient.getGamesByIds(gameIds);
      const gameDetailsMap = new Map<string, GameDetailsDto>();
      gameDetails.forEach((detail) => gameDetailsMap.set(detail.id, detail));

      const enrichedLibraryGames = allLibraryGames.map((game) =>
        LibraryGameDto.fromEntity(game, gameDetailsMap.get(game.gameId)),
      );

      // Field-specific search scoring
      const scoredGames = enrichedLibraryGames
        .map((game) => ({
          game,
          score: this.computeFieldMatchScore(
            normalizedQuery,
            field,
            game.gameDetails,
          ),
        }))
        .filter((entry) => entry.score >= 0.4)
        .sort((a, b) => b.score - a.score);

      const total = scoredGames.length;
      const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
      const startIndex = (page - 1) * limit;
      const paginatedGames = scoredGames
        .slice(startIndex, startIndex + limit)
        .map((entry) => entry.game);

      return {
        games: paginatedGames,
        pagination: {
          total,
          page,
          limit,
          totalPages,
        },
      };
    };

    return await this.cacheService.getCachedSearchResults<LibraryResponseDto>(
      userId,
      cacheKey,
      fetchFn,
    );
  }

  /**
   * Advanced scoring algorithm with weighted field importance and fuzzy matching
   * Provides better relevance scoring for search results
   */
  private computeAdvancedMatchScore(
    query: string,
    details?: GameDetailsDto,
  ): number {
    if (!details) {
      return 0;
    }

    const weights = {
      title: 1.0, // Highest weight for title matches
      developer: 0.8, // High weight for developer matches
      publisher: 0.6, // Medium weight for publisher matches
      tags: 0.7, // High weight for tag matches
    };

    let totalScore = 0;
    let totalWeight = 0;

    // Title matching with highest priority
    if (details.title) {
      const titleScore = this.computeFieldScore(query, details.title);
      if (titleScore > 0) {
        totalScore += titleScore * weights.title;
        totalWeight += weights.title;
      }
    }

    // Developer matching
    if (details.developer) {
      const developerScore = this.computeFieldScore(query, details.developer);
      if (developerScore > 0) {
        totalScore += developerScore * weights.developer;
        totalWeight += weights.developer;
      }
    }

    // Publisher matching
    if (details.publisher) {
      const publisherScore = this.computeFieldScore(query, details.publisher);
      if (publisherScore > 0) {
        totalScore += publisherScore * weights.publisher;
        totalWeight += weights.publisher;
      }
    }

    // Tags matching (check all tags, take best match)
    if (Array.isArray(details.tags) && details.tags.length > 0) {
      let bestTagScore = 0;
      for (const tag of details.tags) {
        const tagScore = this.computeFieldScore(query, tag);
        bestTagScore = Math.max(bestTagScore, tagScore);
      }
      if (bestTagScore > 0) {
        totalScore += bestTagScore * weights.tags;
        totalWeight += weights.tags;
      }
    }

    // Return weighted average of matching fields only
    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  /**
   * Compute match score for a specific field with enhanced fuzzy matching
   */
  private computeFieldScore(query: string, fieldValue: string): number {
    if (!fieldValue || !query) return 0;

    // Normalize both for comparison
    const normalizedField = normalize(fieldValue);
    const normalizedQuery = normalize(query);

    // Exact match gets highest score
    if (normalizedField === normalizedQuery) return 1.0;

    // Substring match gets high score
    if (normalizedField.includes(normalizedQuery)) {
      // Bonus for matches at the beginning
      if (normalizedField.startsWith(normalizedQuery)) return 0.95;
      return 0.85;
    }

    // Word boundary matches
    const words = normalizedField.split(/\s+/);
    for (const word of words) {
      if (word === normalizedQuery) return 0.9;
      if (word.startsWith(normalizedQuery)) return 0.8;
    }

    // Fuzzy matching with improved algorithm
    const fuzzyScore = enhancedSimilarity(normalizedField, normalizedQuery);

    // Apply threshold for fuzzy matches
    return fuzzyScore >= 0.6 ? fuzzyScore * 0.7 : fuzzyScore;
  }

  /**
   * Field-specific matching for targeted searches
   */
  private computeFieldMatchScore(
    query: string,
    field: 'title' | 'developer' | 'publisher' | 'tags',
    details?: GameDetailsDto,
  ): number {
    if (!details) return 0;

    switch (field) {
      case 'title':
        return details.title
          ? this.computeFieldScore(query, normalize(details.title))
          : 0;

      case 'developer':
        return details.developer
          ? this.computeFieldScore(query, normalize(details.developer))
          : 0;

      case 'publisher':
        return details.publisher
          ? this.computeFieldScore(query, normalize(details.publisher))
          : 0;

      case 'tags':
        if (!Array.isArray(details.tags)) return 0;
        let bestScore = 0;
        for (const tag of details.tags) {
          const score = this.computeFieldScore(query, normalize(tag));
          bestScore = Math.max(bestScore, score);
        }
        return bestScore;

      default:
        return 0;
    }
  }
}

/**
 * Normalize text for consistent searching
 * Handles special characters, multiple spaces, and case normalization
 */
function normalize(value: string | undefined | null): string {
  if (!value) return '';

  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s\-]/g, ' ') // Replace special chars with spaces, keep hyphens
    .replace(/\s+/g, ' ') // Normalize multiple spaces
    .trim();
}

/**
 * Create a hash for search queries to optimize caching
 */
function createSearchHash(query: string): string {
  // Simple hash function for cache keys
  let hash = 0;
  for (let i = 0; i < query.length; i++) {
    const char = query.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Enhanced similarity algorithm combining multiple techniques
 * Uses Jaro-Winkler with additional optimizations for better fuzzy matching
 */
function enhancedSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;

  // Quick length-based filtering
  const lengthDiff = Math.abs(a.length - b.length);
  const maxLength = Math.max(a.length, b.length);
  if (lengthDiff / maxLength > 0.7) return 0; // Too different in length

  // Jaro-Winkler similarity
  const jaroWinkler = jaroWinklerSimilarity(a, b);

  // Levenshtein distance normalized
  const levenshtein = 1 - levenshteinDistance(a, b) / maxLength;

  // N-gram similarity for better fuzzy matching
  const ngram = ngramSimilarity(a, b, 2);

  // Weighted combination of different similarity measures
  return jaroWinkler * 0.5 + levenshtein * 0.3 + ngram * 0.2;
}

/**
 * Jaro-Winkler similarity implementation
 */
function jaroWinklerSimilarity(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;

  if (la === 0 && lb === 0) return 1;
  if (la === 0 || lb === 0) return 0;

  const maxDist = Math.floor(Math.max(la, lb) / 2) - 1;
  const matchA: boolean[] = new Array(la).fill(false);
  const matchB: boolean[] = new Array(lb).fill(false);
  let matches = 0;

  // Find matches
  for (let i = 0; i < la; i++) {
    const start = Math.max(0, i - maxDist);
    const end = Math.min(i + maxDist + 1, lb);
    for (let j = start; j < end; j++) {
      if (matchB[j] || a[i] !== b[j]) continue;
      matchA[i] = true;
      matchB[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  // Count transpositions
  let t = 0;
  let k = 0;
  for (let i = 0; i < la; i++) {
    if (!matchA[i]) continue;
    while (!matchB[k]) k++;
    if (a[i] !== b[k]) t++;
    k++;
  }
  t = t / 2;

  // Calculate Jaro similarity
  const jaro = (matches / la + matches / lb + (matches - t) / matches) / 3;

  // Winkler prefix boost
  let prefix = 0;
  for (let i = 0; i < Math.min(4, la, lb) && a[i] === b[i]; i++) {
    prefix++;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

/**
 * Levenshtein distance calculation
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix = Array(b.length + 1)
    .fill(null)
    .map(() => Array(a.length + 1).fill(null));

  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + indicator, // substitution
      );
    }
  }

  return matrix[b.length][a.length];
}

/**
 * N-gram similarity for fuzzy matching
 */
function ngramSimilarity(a: string, b: string, n: number = 2): number {
  const aNgrams = getNgrams(a, n);
  const bNgrams = getNgrams(b, n);

  if (aNgrams.size === 0 && bNgrams.size === 0) return 1;
  if (aNgrams.size === 0 || bNgrams.size === 0) return 0;

  const intersection = new Set([...aNgrams].filter((x) => bNgrams.has(x)));
  const union = new Set([...aNgrams, ...bNgrams]);

  return intersection.size / union.size;
}

/**
 * Generate n-grams from a string
 */
function getNgrams(str: string, n: number): Set<string> {
  const ngrams = new Set<string>();
  const paddedStr = ' '.repeat(n - 1) + str + ' '.repeat(n - 1);

  for (let i = 0; i <= paddedStr.length - n; i++) {
    ngrams.add(paddedStr.slice(i, i + n));
  }

  return ngrams;
}
