import { Inject, Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoggingService } from '../logs/logging.service';
import { IPBlock } from '../../entities/ip-block.entity';
import { CheckLoginSecurityDto } from '../../dto/requests/check-login-security.dto';
import { CheckTransactionSecurityDto } from '../../dto/requests/check-transaction-security.dto';
import { SecurityCheckResult } from '../../dto/responses/security-check-result.dto';
import { SecurityEventType } from '../../common/enums/security-event-type.enum';
import { CreateSecurityEventDto } from '../../dto/internal/create-security-event.dto';
import { RateLimitService } from './rate-limit.service';
import { ConfigService } from '@nestjs/config';
import { REDIS_CLIENT } from '../../redis/redis.constants';
import type Redis from 'ioredis';
import { SecurityContext } from './types/security-context';
import { MetricsService } from '../../common/metrics/metrics.service';
import { UserServiceClient } from '../../clients/user-service.client';

@Injectable()
export class SecurityService {
  constructor(
    private readonly logging: LoggingService,
    private readonly rl: RateLimitService,
    private readonly config: ConfigService,
    @InjectRepository(IPBlock)
    private readonly ipBlockRepo: Repository<IPBlock>,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
    @Optional() private readonly metrics?: MetricsService,
    @Optional() private readonly users?: UserServiceClient,
  ) {}

  async checkLoginSecurity(dto: CheckLoginSecurityDto): Promise<SecurityCheckResult> {
    const blocked = await this.isIPBlocked(dto.ip);
    if (blocked) {
      const result: SecurityCheckResult = {
        allowed: false,
        riskScore: 100,
        reason: 'IP is blocked',
        recommendations: ['BLOCK_IP'],
      };
      const event: CreateSecurityEventDto = {
        type: SecurityEventType.LOGIN,
        userId: dto.userId,
        ip: dto.ip,
        userAgent: dto.userAgent,
        data: { policy: 'blocked-ip', context: dto.context },
        riskScore: result.riskScore,
      };
      await this.logging.logSecurityEvent(event);
      return result;
    }

    const perMinLimitIp = this.config.get<number>('SECURITY_LOGIN_PER_MINUTE_IP', 20);
    const perMinLimitUser = this.config.get<number>('SECURITY_LOGIN_PER_MINUTE_USER', 10);

    const rlIp = await this.rl.checkRateLimit(
      this.key(`rl:login:ip:${dto.ip}:1m`),
      perMinLimitIp,
      60,
    );
    const rlUser = await this.rl.checkRateLimit(
      this.key(`rl:login:user:${dto.userId}:1m`),
      perMinLimitUser,
      60,
    );

    const allowed = rlIp.allowed && rlUser.allowed;
    let risk = 10;
    risk += Math.floor(((perMinLimitIp - rlIp.remaining) / Math.max(1, perMinLimitIp)) * 40);
    risk += Math.floor(((perMinLimitUser - rlUser.remaining) / Math.max(1, perMinLimitUser)) * 40);
    risk = Math.min(95, risk);
    let reason: string | undefined;

    if (!allowed) {
      reason = 'Rate limit exceeded';
      risk = Math.max(risk, 85);
    }

    const result: SecurityCheckResult = {
      allowed,
      riskScore: risk,
      reason,
    };

    // Optional enrichment via User Service (if configured)
    if (dto.userId && this.users) {
      try {
        const info = await this.users.getUserSecurityInfo(dto.userId);
        if (info?.locked) {
          result.allowed = false;
          result.riskScore = 100;
          result.reason = 'User is locked';
        } else if (info?.flagged) {
          result.riskScore = Math.min(99, result.riskScore + 10);
        }
      } catch {
        // ignore client errors
      }
    }

    const event: CreateSecurityEventDto = {
      type: SecurityEventType.LOGIN,
      userId: dto.userId,
      ip: dto.ip,
      userAgent: dto.userAgent,
      data: { rlIp, rlUser, context: dto.context },
      riskScore: result.riskScore,
    };
    await this.logging.logSecurityEvent(event);

    this.metrics?.recordCheck('login', result.allowed, 0);

    return result;
  }

  async checkTransactionSecurity(dto: CheckTransactionSecurityDto): Promise<SecurityCheckResult> {
    const blocked = await this.isIPBlocked(dto.ip);
    if (blocked) {
      const result: SecurityCheckResult = {
        allowed: false,
        riskScore: 100,
        reason: 'IP is blocked',
        recommendations: ['BLOCK_IP'],
      };
      const event: CreateSecurityEventDto = {
        type: SecurityEventType.PURCHASE,
        userId: dto.userId,
        ip: dto.ip,
        data: { policy: 'blocked-ip', amount: dto.amount, method: dto.paymentMethod },
        riskScore: result.riskScore,
      };
      await this.logging.logSecurityEvent(event);
      return result;
    }

    const txnPerMinUser = this.config.get<number>('SECURITY_TXN_PER_MINUTE_USER', 15);
    const amountThreshold = this.config.get<number>('SECURITY_TXN_AMOUNT_THRESHOLD', 10000);

    const rlTxn = await this.rl.checkRateLimit(
      this.key(`rl:txn:user:${dto.userId}:1m`),
      txnPerMinUser,
      60,
    );

    const allowed = rlTxn.allowed;
    let risk =
      15 + Math.floor(((txnPerMinUser - rlTxn.remaining) / Math.max(1, txnPerMinUser)) * 40);
    let reason: string | undefined;

    if (dto.amount && dto.amount >= amountThreshold) {
      risk += 30;
      reason = 'High amount transaction';
    }

    if (!allowed) {
      risk = Math.max(risk, 85);
      reason = reason ? `${reason}; Rate limit exceeded` : 'Rate limit exceeded';
    }

    risk = Math.min(99, risk);

    const result: SecurityCheckResult = {
      allowed,
      riskScore: risk,
      reason,
    };

    const event: CreateSecurityEventDto = {
      type: SecurityEventType.PURCHASE,
      userId: dto.userId,
      ip: dto.ip,
      data: { rlTxn, amount: dto.amount, method: dto.paymentMethod, context: dto.context },
      riskScore: result.riskScore,
    };
    await this.logging.logSecurityEvent(event);

    this.metrics?.recordCheck('transaction', result.allowed, 0);

    return result;
  }

  async blockIP(ip: string, reason: string, durationMinutes: number): Promise<void> {
    const durationSeconds = durationMinutes * 60;
    const until = new Date(Date.now() + durationSeconds * 1000);
    const entity = this.ipBlockRepo.create({ ip, reason, blockedUntil: until, isActive: true });
    await this.ipBlockRepo.save(entity);
    // Warm redis to speed up checks
    await this.redis.set(this.key(`block:ip:${ip}`), '1', 'EX', durationSeconds);
    const event: CreateSecurityEventDto = {
      type: SecurityEventType.SUSPICIOUS_ACTIVITY,
      ip,
      data: { reason, blockedUntil: until.toISOString() },
    };
    await this.logging.logSecurityEvent(event);
    this.metrics?.recordIpBlock(reason);
  }

  async isIPBlocked(ip: string): Promise<boolean> {
    try {
      const cache = await this.redis.get(this.key(`block:ip:${ip}`));
      if (cache) return true;

      const now = new Date();
      const active = await this.ipBlockRepo.findOne({ where: { ip, isActive: true } });
      if (!active) return false;
      if (!active.blockedUntil || active.blockedUntil > now) return true;
      // expired -> deactivate
      active.isActive = false;
      await this.ipBlockRepo.save(active);
      return false;
    } catch (_e) {
      // On any storage issue, default to not blocked
      return false;
    }
  }

  async validateUserActivity(userId: string, activityType: string): Promise<boolean> {
    const userLimit = this.config.get<number>('SECURITY_ACTIVITY_PER_MINUTE', 60);
    const res = await this.rl.checkRateLimit(
      this.key(`rl:act:${activityType}:user:${userId}:1m`),
      userLimit,
      60,
    );
    return res.allowed;
  }

  async calculateRiskScore(userId: string, context: SecurityContext): Promise<number> {
    let score = 5;
    if (context.ip) {
      const blocked = await this.isIPBlocked(context.ip);
      if (blocked) return 100;
      const rlIp = await this.rl.getRemainingRequests(
        this.key(`rl:login:ip:${context.ip}:1m`),
        this.config.get('SECURITY_LOGIN_PER_MINUTE_IP', 20),
      );
      score += Math.floor(
        ((this.config.get('SECURITY_LOGIN_PER_MINUTE_IP', 20) - rlIp) /
          Math.max(1, this.config.get('SECURITY_LOGIN_PER_MINUTE_IP', 20))) *
          40,
      );
    }

    const rlUser = await this.rl.getRemainingRequests(
      this.key(`rl:login:user:${userId}:1m`),
      this.config.get('SECURITY_LOGIN_PER_MINUTE_USER', 10),
    );
    score += Math.floor(
      ((this.config.get('SECURITY_LOGIN_PER_MINUTE_USER', 10) - rlUser) /
        Math.max(1, this.config.get('SECURITY_LOGIN_PER_MINUTE_USER', 10))) *
        40,
    );

    if (
      context.amount &&
      context.amount >= this.config.get('SECURITY_TXN_AMOUNT_THRESHOLD', 10000)
    ) {
      score += 20;
    }

    // Optional: adjust using User Service info
    if (this.users) {
      try {
        const info = await this.users.getUserSecurityInfo(userId);
        if (info?.locked) return 100;
        if (info?.flagged) score = Math.min(99, score + 10);
      } catch {
        // ignore
      }
    }

    return Math.max(0, Math.min(99, score));
  }

  private key(k: string) {
    return `security:${k}`;
  }
}
