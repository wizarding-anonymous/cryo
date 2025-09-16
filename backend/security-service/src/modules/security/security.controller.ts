import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { SecurityService } from './security.service';
import { CheckLoginSecurityDto } from '../../dto/requests/check-login-security.dto';
import { CheckTransactionSecurityDto } from '../../dto/requests/check-transaction-security.dto';
import { SecurityCheckResult } from '../../dto/responses/security-check-result.dto';
import { ReportSecurityEventDto } from '../../dto/requests/report-security-event.dto';
import { BlockIPDto } from '../../dto/requests/block-ip.dto';
import { IPStatusResult } from '../../dto/responses/ip-status-result.dto';
import { LoggingService } from '../logs/logging.service';
import { AdminGuard } from '../../common/guards/admin.guard';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IPBlock } from '../../entities/ip-block.entity';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Security')
@Controller('security')
export class SecurityController {
  constructor(
    private readonly security: SecurityService,
    private readonly logging: LoggingService,
    @InjectRepository(IPBlock)
    private readonly ipBlockRepo: Repository<IPBlock>,
  ) {}

  @Post('check-login')
  @HttpCode(200)
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'check-login', limit: 60, window: 60, keyBy: 'ip' })
  @ApiOperation({ summary: 'Проверка безопасности входа' })
  checkLoginSecurity(@Body() dto: CheckLoginSecurityDto): Promise<SecurityCheckResult> {
    return this.security.checkLoginSecurity(dto);
  }

  @Post('check-transaction')
  @HttpCode(200)
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'check-transaction', limit: 60, window: 60, keyBy: 'user' })
  @ApiOperation({ summary: 'Проверка безопасности транзакции' })
  checkTransactionSecurity(@Body() dto: CheckTransactionSecurityDto): Promise<SecurityCheckResult> {
    return this.security.checkTransactionSecurity(dto);
  }

  @Post('report-event')
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'report-event', limit: 120, window: 60, keyBy: 'ip' })
  @ApiOperation({ summary: 'Логирование security-события' })
  @HttpCode(204)
  async reportSecurityEvent(@Body() dto: ReportSecurityEventDto): Promise<void> {
    await this.logging.logSecurityEvent({
      type: dto.type,
      userId: dto.userId,
      ip: dto.ip,
      data: dto.data,
    });
  }

  @Post('block-ip')
  @ApiOperation({ summary: 'Заблокировать IP на заданный срок' })
  @UseGuards(AdminGuard)
  @HttpCode(204)
  async blockIP(@Body() dto: BlockIPDto): Promise<void> {
    await this.security.blockIP(dto.ip, dto.reason, dto.durationMinutes);
  }

  @Get('ip-status/:ip')
  @ApiOperation({ summary: 'Проверить статус IP (заблокирован/нет)' })
  async checkIPStatus(@Param('ip') ip: string): Promise<IPStatusResult> {
    const isBlocked = await this.security.isIPBlocked(ip);
    let reason: string | undefined;
    let blockedUntil: Date | undefined;
    if (isBlocked) {
      const active = await this.ipBlockRepo.findOne({ where: { ip, isActive: true } });
      if (active) {
        reason = active.reason ?? undefined;
        blockedUntil = active.blockedUntil ?? undefined;
      }
    }
    return { isBlocked, reason, blockedUntil };
  }
}
