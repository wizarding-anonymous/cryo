#!/usr/bin/env ts-node

/**
 * Скрипт для проверки доступности сервисов (PostgreSQL и Redis)
 * 
 * Использование:
 * npm run services:check
 */

import { Logger } from '@nestjs/common';
import { DataSource, DataSourceOptions } from 'typeorm';
import { createClient } from 'redis';
import { getDatabaseConfig } from '../src/database/database.config';
import { ConfigService } from '@nestjs/config';

class ServiceChecker {
    private readonly logger = new Logger('ServiceChecker');

    async checkServices(): Promise<void> {
        this.logger.log('🔍 Checking service availability...');

        const results = {
            postgres: false,
            redis: false
        };

        // Check PostgreSQL
        try {
            const configService = new ConfigService();
            const dbConfig = getDatabaseConfig(configService);

            this.logger.log('📊 Checking PostgreSQL connection...');
            const dataSource = new DataSource({
                ...dbConfig,
                synchronize: false,
                logging: false,
                entities: [], // Убираем entities для простой проверки подключения
                migrations: [], // Убираем migrations для простой проверки подключения
            } as DataSourceOptions);

            await dataSource.initialize();
            await dataSource.query('SELECT 1');
            await dataSource.destroy();

            results.postgres = true;
            this.logger.log('✅ PostgreSQL: Connected successfully');
        } catch (error) {
            this.logger.error('❌ PostgreSQL: Connection failed');
            this.logger.error(`   Error: ${error.message}`);
        }

        // Check Redis
        try {
            this.logger.log('🔴 Checking Redis connection...');
            const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
            const client = createClient({ url: redisUrl });

            await client.connect();
            await client.ping();
            await client.disconnect();

            results.redis = true;
            this.logger.log('✅ Redis: Connected successfully');
        } catch (error) {
            this.logger.error('❌ Redis: Connection failed');
            this.logger.error(`   Error: ${error.message}`);
        }

        // Summary
        this.logger.log('\n📋 Service Status Summary:');
        this.logger.log(`   PostgreSQL: ${results.postgres ? '✅ Available' : '❌ Unavailable'}`);
        this.logger.log(`   Redis: ${results.redis ? '✅ Available' : '❌ Unavailable'}`);

        if (results.postgres && results.redis) {
            this.logger.log('\n🎉 All services are available! You can run consistency checks.');
            process.exit(0);
        } else {
            this.logger.log('\n⚠️  Some services are unavailable. Please start them before running consistency checks.');
            this.logger.log('\n💡 To start services with Docker:');
            this.logger.log('   docker-compose up -d postgres redis');
            process.exit(1);
        }
    }
}

// Запуск проверки
if (require.main === module) {
    const checker = new ServiceChecker();
    checker.checkServices().catch((error) => {
        console.error('Service check failed:', error);
        process.exit(1);
    });
}

export { ServiceChecker };