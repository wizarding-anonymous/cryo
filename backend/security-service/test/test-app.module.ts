import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppModule } from '../src/app.module';

@Module({
  imports: [
    // Import the main AppModule to get all real providers, controllers, etc.
    AppModule,
    // Override the main database connection for the testing environment
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const testDbUrl = config.get<string>('TEST_DATABASE_URL');
        if (!testDbUrl) {
          // Fallback to a local test DB if the env var is not set
          console.warn('TEST_DATABASE_URL not set, falling back to local test DB config.');
          return {
            type: 'postgres',
            host: 'localhost',
            port: 5433, // Use a different port to avoid conflicts
            username: 'test_user',
            password: 'test_password',
            database: 'security_service_test',
            autoLoadEntities: true,
            synchronize: true, // Auto-creates schema. OK for a test DB.
            dropSchema: true, // Ensures a clean slate for every test run
          };
        }
        return {
          type: 'postgres',
          url: testDbUrl,
          autoLoadEntities: true,
          synchronize: true,
          dropSchema: true,
        };
      },
    }),
  ],
})
export class TestAppModule {}
