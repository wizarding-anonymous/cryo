import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Session,
  LoginAttempt,
  TokenBlacklist,
  SecurityEvent,
} from '../entities';
import {
  SessionRepository,
  LoginAttemptRepository,
  TokenBlacklistRepository,
  SecurityEventRepository,
} from './';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Session,
      LoginAttempt,
      TokenBlacklist,
      SecurityEvent,
    ]),
  ],
  providers: [
    SessionRepository,
    LoginAttemptRepository,
    TokenBlacklistRepository,
    SecurityEventRepository,
  ],
  exports: [
    SessionRepository,
    LoginAttemptRepository,
    TokenBlacklistRepository,
    SecurityEventRepository,
    TypeOrmModule,
  ],
})
export class RepositoryModule {}