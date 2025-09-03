import { Injectable, OnModuleInit, Logger, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { Game } from '../../domain/entities/game.entity';
import { SearchQueryDto } from '../../infrastructure/http/dtos/search-query.dto';

@Injectable()
@UseInterceptors(CacheInterceptor)
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  private readonly index = 'games';

  constructor(private readonly elasticsearchService: ElasticsearchService) {}

  async onModuleInit() {
    await this.createIndexIfNotExists();
  }

  private async createIndexIfNotExists() {
    const { body: indexExists } = await this.elasticsearchService.indices.exists({ index: this.index });
    if (!indexExists) {
      this.logger.log(`Index "${this.index}" not found. Creating...`);
      await this.elasticsearchService.indices.create({
        index: this.index,
        body: {
          mappings: {
            properties: {
              id: { type: 'keyword' },
              title: {
                type: 'text',
                analyzer: 'russian',
                fields: {
                  suggest: { type: 'completion' },
                },
              },
              description: { type: 'text', analyzer: 'russian' },
              developerName: { type: 'text', analyzer: 'russian' },
              price: { type: 'float' },
              releaseDate: { type: 'date' },
              status: { type: 'keyword' },
              tags: { type: 'keyword' },
              categories: { type: 'keyword' },
              averageRating: { type: 'float' },
            },
          },
          settings: {
            analysis: {
              analyzer: {
                russian: {
                  tokenizer: 'standard',
                  filter: ['lowercase', 'russian_morphology', 'russian_stop'],
                },
              },
            },
          },
        },
      });
      this.logger.log(`Index "${this.index}" created.`);
    }
  }

  async indexGame(game: Game) {
    await this.elasticsearchService.index({
      index: this.index,
      id: game.id,
      body: {
        id: game.id,
        title: game.title,
        description: game.description,
        developerName: game.developerName,
        price: game.price,
        releaseDate: game.releaseDate,
        status: game.status,
        averageRating: game.averageRating,
        tags: game.tags?.map(t => t.name) || [],
        categories: game.categories?.map(c => c.name) || [],
      },
    });
  }

  async updateGame(game: Game) {
    // Elasticsearch's index operation is an "upsert" - it creates or updates.
    // This method is for semantic clarity.
    return this.indexGame(game);
  }

  async removeGame(gameId: string) {
    await this.elasticsearchService.delete({
      index: this.index,
      id: gameId,
    });
  }

  @CacheTTL(60) // 60 seconds
  async search(searchQueryDto: SearchQueryDto) {
    const { q, tags, categories, minPrice, maxPrice, status, releaseDateFrom, releaseDateTo, sortBy, sortOrder } = searchQueryDto;

    const boolQuery: any = {
        must: [],
        filter: [],
    };

    if (q) {
        boolQuery.must.push({
            multi_match: {
                query: q,
                fields: ['title', 'description', 'developerName'],
            },
        });
    } else {
        boolQuery.must.push({ match_all: {} });
    }

    if (tags && tags.length > 0) {
        boolQuery.filter.push({ terms: { tags: tags } });
    }

    if (categories && categories.length > 0) {
        boolQuery.filter.push({ terms: { categories: categories } });
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
        const priceRange: any = {};
        if (minPrice !== undefined) priceRange.gte = minPrice;
        if (maxPrice !== undefined) priceRange.lte = maxPrice;
        boolQuery.filter.push({ range: { price: priceRange } });
    }

    if (status) {
        boolQuery.filter.push({ term: { status: status } });
    }

    if (releaseDateFrom || releaseDateTo) {
        const dateRange: any = {};
        if (releaseDateFrom) dateRange.gte = releaseDateFrom;
        if (releaseDateTo) dateRange.lte = releaseDateTo;
        boolQuery.filter.push({ range: { releaseDate: dateRange } });
    }

    const sort = sortBy ? [{ [sortBy]: { order: sortOrder } }] : [];

    const { body } = await this.elasticsearchService.search({
      index: this.index,
      body: {
        query: {
          bool: boolQuery,
        },
        sort: sort,
      },
    });

    return body.hits.hits.map((hit) => hit._source);
  }

  async getSearchSuggestions(prefix: string): Promise<string[]> {
    if (!prefix) {
      return [];
    }

    const { body } = await this.elasticsearchService.search({
      index: this.index,
      body: {
        suggest: {
          'title-suggester': {
            prefix: prefix,
            completion: {
              field: 'title.suggest',
              size: 5,
              skip_duplicates: true,
            },
          },
        },
      },
    });

    const suggestions = body.suggest['title-suggester'][0].options.map(
      (option) => option.text,
    );
    return suggestions;
  }
}
