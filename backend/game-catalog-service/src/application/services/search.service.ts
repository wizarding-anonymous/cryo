import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { Game } from '../../domain/entities/game.entity';
import { SearchQueryDto } from '../../infrastructure/http/dtos/search-query.dto';

@Injectable()
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
        developerName: 'Developer Name Placeholder', // This should come from a relation
        price: game.price,
        releaseDate: game.releaseDate,
        status: game.status,
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

  async search(searchQueryDto: SearchQueryDto) {
    const { q, tags, categories, minPrice, maxPrice, sortBy, sortOrder } = searchQueryDto;

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
}
