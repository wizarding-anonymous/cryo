import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ElasticsearchModule as NestElasticsearchModule } from '@nestjs/elasticsearch';

@Module({
  imports: [
    NestElasticsearchModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        node: configService.get<string>('elasticsearch.node'),
      }),
      inject: [ConfigService],
    }),
  ],
  exports: [NestElasticsearchModule],
})
export class ElasticsearchModule {}
