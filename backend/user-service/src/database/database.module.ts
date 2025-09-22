import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { AppConfigModule } from '../config/config.module';
import { ConfigFactory } from '../config/config.factory';
import { EnvironmentVariables } from '../config/env.validation';

@Module({
  imports: [
    AppConfigModule,
    TypeOrmModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<EnvironmentVariables>) => {
        const configFactory = new ConfigFactory(configService);
        
        // Validate configuration before creating TypeORM config
        configFactory.validateConfiguration();
        
        return configFactory.createTypeOrmConfig();
      },
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
