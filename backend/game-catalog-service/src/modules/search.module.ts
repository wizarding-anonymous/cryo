import { Module } from '@nestjs/common';
import { ElasticsearchModule } from '../infrastructure/search/elasticsearch.module';
import { SearchService } from '../application/services/search.service';
import { SearchController } from '../infrastructure/http/controllers/search.controller';

@Module({
  imports: [ElasticsearchModule],
  providers: [SearchService],
  exports: [SearchService],
  controllers: [SearchController],
})
export class SearchModule {}
