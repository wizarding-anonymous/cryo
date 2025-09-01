import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT, 10) || 5432,
  username: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
  database: process.env.DATABASE_DB || 'game_catalog',
}));

export const redisConfig = registerAs('redis', () => ({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
}));

export const elasticsearchConfig = registerAs('elasticsearch', () => ({
    node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
}));

export const s3Config = registerAs('s3', () => ({
    endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
    bucket: process.env.S3_BUCKET || 'game-media',
    region: 'us-east-1', // MinIO default
}));
