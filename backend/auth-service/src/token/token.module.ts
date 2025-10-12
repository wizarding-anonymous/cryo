import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TokenService } from './token.service';
import { RedisModule } from '../common/redis/redis.module';
import { DatabaseModule } from '../database/database.module';
import { DistributedTransactionModule } from '../common/distributed-transaction/distributed-transaction.module';

@Module({
  imports: [
    RedisModule, 
    DatabaseModule,
    DistributedTransactionModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '1h'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [TokenService],
  exports: [TokenService],
})
export class TokenModule {}