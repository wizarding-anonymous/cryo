import { Injectable } from '@nestjs/common';
import { LibraryRepository } from './repositories/library.repository';
import { SearchLibraryDto } from './dto/request.dto';
import { GameCatalogClient } from '../clients/game-catalog.client';
import { LibraryResponseDto, LibraryGameDto, GameDetailsDto } from './dto/response.dto';
import { CacheService } from '../cache/cache.service';
import { LibraryGame } from './entities/library-game.entity';

@Injectable()
export class SearchService {
  constructor(
    private readonly libraryRepository: LibraryRepository,
    private readonly gameCatalogClient: GameCatalogClient,
    private readonly cacheService: CacheService,
  ) {}

  async searchUserLibrary(
    userId: string,
    searchDto: SearchLibraryDto,
  ): Promise<LibraryResponseDto> {
    const page = searchDto.page ?? 1;
    const limit = searchDto.limit ?? 20;

    const cacheKey = `search_library_${userId}_page_${page}_limit_${limit}_q_${normalize(searchDto.query)}`;

    const fetchFn = async (): Promise<LibraryResponseDto> => {
      const allLibraryGames = await this.libraryRepository.find({ where: { userId } });
      if (allLibraryGames.length === 0) {
        return { games: [], pagination: { total: 0, page, limit, totalPages: 0 } };
      }

    const gameIds = allLibraryGames.map((game) => game.gameId);
    const gameDetails = await this.gameCatalogClient.getGamesByIds(gameIds);
    const gameDetailsMap = new Map<string, GameDetailsDto>();
    gameDetails.forEach((detail) => gameDetailsMap.set(detail.id, detail));

    const enrichedLibraryGames = allLibraryGames.map((game) =>
      LibraryGameDto.fromEntity(game, gameDetailsMap.get(game.gameId)),
    );

    const query = normalize(searchDto.query);
    const filteredGames = enrichedLibraryGames
      .map((game) => ({
        game,
        score: computeBestMatchScore(query, game.gameDetails),
      }))
      .filter((entry) => entry.score >= 0.5)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.game);

      const total = filteredGames.length;
      const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
      const startIndex = (page - 1) * limit;
      const paginatedGames = filteredGames.slice(startIndex, startIndex + limit);

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

    const response = await this.cacheService.getOrSet<LibraryResponseDto>(cacheKey, fetchFn, 300);
    await recordUserCacheKey(this.cacheService, userId, cacheKey);
    return response;
  }
}

function normalize(value: string | undefined | null): string {
  return (value ?? '').toLowerCase().trim();
}

// Computes a fuzzy score [0..1] across title, developer, publisher, tags
function computeBestMatchScore(query: string, details?: GameDetailsDto): number {
  if (!details) {
    return 0;
  }
  const candidates: string[] = [];
  candidates.push(normalize(details.title));
  candidates.push(normalize(details.developer));
  candidates.push(normalize(details.publisher));
  if (Array.isArray(details.tags)) {
    for (const tag of details.tags) {
      candidates.push(normalize(tag));
    }
  }

  let best = 0;
  for (const candidate of candidates) {
    if (!candidate) continue;
    // Fast exact/substring boosts
    if (candidate === query) return 1;
    if (candidate.includes(query)) best = Math.max(best, 0.85);
    // Fuzzy similarity
    best = Math.max(best, similarity(candidate, query));
  }
  return best;
}

async function recordUserCacheKey(cacheService: CacheService, userId: string, key: string): Promise<void> {
  const userCacheKeysKey = `user-cache-keys:${userId}`;
  const userKeys = (await cacheService.get<string[]>(userCacheKeysKey)) ?? [];
  if (!userKeys.includes(key)) {
    userKeys.push(key);
    await cacheService.set(userCacheKeysKey, userKeys, 0);
  }
}

// Jaro-Winkler-like lightweight similarity (no deps)
function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const la = a.length;
  const lb = b.length;
  const maxDist = Math.floor(Math.max(la, lb) / 2) - 1;
  const matchA: boolean[] = new Array(la).fill(false);
  const matchB: boolean[] = new Array(lb).fill(false);
  let matches = 0;
  for (let i = 0; i < la; i++) {
    const start = Math.max(0, i - maxDist);
    const end = Math.min(i + maxDist + 1, lb);
    for (let j = start; j < end; j++) {
      if (matchB[j]) continue;
      if (a[i] !== b[j]) continue;
      matchA[i] = true;
      matchB[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;
  let t = 0;
  let k = 0;
  for (let i = 0; i < la; i++) {
    if (!matchA[i]) continue;
    while (!matchB[k]) k++;
    if (a[i] !== b[k]) t++;
    k++;
  }
  t = t / 2;
  const jaro = (matches / la + matches / lb + (matches - t) / matches) / 3;
  // Winkler prefix boost
  let prefix = 0;
  for (let i = 0; i < Math.min(4, la, lb) && a[i] === b[i]; i++) prefix++;
  return jaro + prefix * 0.1 * (1 - jaro);
}
