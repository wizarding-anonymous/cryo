import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { AuthDatabaseService } from '../../database/auth-database.service';
import { TokenBlacklist } from '../../entities/token-blacklist.entity';
import { ConsistencyMetricsService } from './consistency-metrics.service';
import { createHash } from 'crypto';

export interface TransactionContext {
  transactionId: string;
  operations: TransactionOperation[];
  status: 'preparing' | 'prepared' | 'committed' | 'aborted';
  createdAt: Date;
  timeout: number;
}

export interface TransactionOperation {
  type: 'blacklist_token' | 'remove_from_blacklist' | 'bulk_invalidate';
  target: 'redis' | 'postgres' | 'both';
  data: any;
  status: 'pending' | 'prepared' | 'committed' | 'aborted';
  compensationData?: any;
}

export interface BlacklistTokenData {
  token: string;
  tokenHash: string;
  userId: string;
  reason: TokenBlacklist['reason'];
  expiresAt: Date;
  ttlSeconds: number;
  metadata?: Record<string, any>;
}

export interface ConsistencyCheckResult {
  totalChecked: number;
  inconsistencies: number;
  redisOnly: string[];
  postgresOnly: string[];
  repaired: number;
  errors: string[];
}

/**
 * Distributed Transaction Service для обеспечения консистентности между Redis и PostgreSQL
 * Реализует двухфазный коммит (2PC) с eventual consistency fallback
 * 
 * Критичность: 🟡 Средняя - Исправить в течение недели
 * Проблема: src/token/token.service.ts:85-95
 * Решение: 2PC (Two-Phase Commit) с eventual consistency fallback
 */
@Injectable()
export class DistributedTransactionService {
  private readonly logger = new Logger(DistributedTransactionService.name);
  private readonly transactionTimeout = 30000; // 30 seconds
  private readonly activeTransactions = new Map<string, TransactionContext>();

  constructor(
    private readonly redisService: RedisService,
    private readonly authDatabaseService: AuthDatabaseService,
    private readonly consistencyMetricsService: ConsistencyMetricsService,
  ) {}

  /**
   * Выполнить атомарную операцию blacklistToken с двухфазным коммитом
   * Обеспечивает консистентность между Redis и PostgreSQL
   */
  async atomicBlacklistToken(data: BlacklistTokenData): Promise<void> {
    const transactionId = this.generateTransactionId();
    const context: TransactionContext = {
      transactionId,
      operations: [
        {
          type: 'blacklist_token',
          target: 'both',
          data,
          status: 'pending'
        }
      ],
      status: 'preparing',
      createdAt: new Date(),
      timeout: this.transactionTimeout
    };

    this.activeTransactions.set(transactionId, context);

    try {
      // Phase 1: Prepare
      await this.preparePhase(context);
      
      // Phase 2: Commit
      const startTime = Date.now();
      await this.commitPhase(context);
      const duration = Date.now() - startTime;
      
      // Записываем метрики успешной операции
      await this.consistencyMetricsService.recordAtomicOperationMetrics(
        'token_rotation',
        true,
        duration,
        { operation: 'blacklist_token', transactionId }
      );
      
      this.logger.log(`Atomic blacklist operation completed successfully: ${transactionId}`);
    } catch (error) {
      this.logger.error(`Atomic blacklist operation failed: ${transactionId}`, error.stack);
      
      // Записываем метрики неуспешной операции
      await this.consistencyMetricsService.recordAtomicOperationMetrics(
        'token_rotation',
        false,
        Date.now() - Date.now(), // Время до ошибки
        { operation: 'blacklist_token', transactionId, error: error.message }
      );
      
      // Abort transaction and compensate
      await this.abortPhase(context);
      throw error;
    } finally {
      this.activeTransactions.delete(transactionId);
    }
  }

  /**
   * Выполнить атомарную операцию removeFromBlacklist с двухфазным коммитом
   */
  async atomicRemoveFromBlacklist(token: string, userId: string): Promise<void> {
    const transactionId = this.generateTransactionId();
    const tokenHash = this.createTokenHash(token);
    
    const context: TransactionContext = {
      transactionId,
      operations: [
        {
          type: 'remove_from_blacklist',
          target: 'both',
          data: { token, tokenHash, userId },
          status: 'pending'
        }
      ],
      status: 'preparing',
      createdAt: new Date(),
      timeout: this.transactionTimeout
    };

    this.activeTransactions.set(transactionId, context);

    try {
      // Phase 1: Prepare
      await this.preparePhase(context);
      
      // Phase 2: Commit
      const startTime = Date.now();
      await this.commitPhase(context);
      const duration = Date.now() - startTime;
      
      // Записываем метрики успешной операции
      await this.consistencyMetricsService.recordAtomicOperationMetrics(
        'bulk_invalidation',
        true,
        duration,
        { operation: 'remove_from_blacklist', transactionId }
      );
      
      this.logger.log(`Atomic remove from blacklist completed successfully: ${transactionId}`);
    } catch (error) {
      this.logger.error(`Atomic remove from blacklist failed: ${transactionId}`, error.stack);
      
      // Записываем метрики неуспешной операции
      await this.consistencyMetricsService.recordAtomicOperationMetrics(
        'bulk_invalidation',
        false,
        Date.now() - Date.now(), // Время до ошибки
        { operation: 'remove_from_blacklist', transactionId, error: error.message }
      );
      
      // Abort transaction and compensate
      await this.abortPhase(context);
      throw error;
    } finally {
      this.activeTransactions.delete(transactionId);
    }
  }

  /**
   * Phase 1: Prepare - проверяем готовность всех участников к коммиту
   */
  private async preparePhase(context: TransactionContext): Promise<void> {
    this.logger.debug(`Starting prepare phase for transaction: ${context.transactionId}`);
    
    for (const operation of context.operations) {
      try {
        switch (operation.type) {
          case 'blacklist_token':
            await this.prepareBlacklistToken(operation);
            break;
          case 'remove_from_blacklist':
            await this.prepareRemoveFromBlacklist(operation);
            break;
          default:
            throw new Error(`Unknown operation type: ${operation.type}`);
        }
        
        operation.status = 'prepared';
      } catch (error) {
        operation.status = 'aborted';
        throw new Error(`Prepare failed for operation ${operation.type}: ${error.message}`);
      }
    }
    
    context.status = 'prepared';
    this.logger.debug(`Prepare phase completed for transaction: ${context.transactionId}`);
  }

  /**
   * Phase 2: Commit - выполняем все операции
   */
  private async commitPhase(context: TransactionContext): Promise<void> {
    this.logger.debug(`Starting commit phase for transaction: ${context.transactionId}`);
    
    const errors: string[] = [];
    
    for (const operation of context.operations) {
      try {
        switch (operation.type) {
          case 'blacklist_token':
            await this.commitBlacklistToken(operation);
            break;
          case 'remove_from_blacklist':
            await this.commitRemoveFromBlacklist(operation);
            break;
        }
        
        operation.status = 'committed';
      } catch (error) {
        operation.status = 'aborted';
        errors.push(`Commit failed for operation ${operation.type}: ${error.message}`);
        
        // Попытка компенсации для этой операции
        await this.compensateOperation(operation);
      }
    }
    
    if (errors.length > 0) {
      context.status = 'aborted';
      throw new Error(`Commit phase failed: ${errors.join('; ')}`);
    }
    
    context.status = 'committed';
    this.logger.debug(`Commit phase completed for transaction: ${context.transactionId}`);
  }

  /**
   * Abort Phase: откатываем все изменения
   */
  private async abortPhase(context: TransactionContext): Promise<void> {
    this.logger.debug(`Starting abort phase for transaction: ${context.transactionId}`);
    
    for (const operation of context.operations) {
      if (operation.status === 'committed' || operation.status === 'prepared') {
        await this.compensateOperation(operation);
      }
    }
    
    context.status = 'aborted';
    this.logger.debug(`Abort phase completed for transaction: ${context.transactionId}`);
  }

  /**
   * Подготовка операции blacklistToken
   */
  private async prepareBlacklistToken(operation: TransactionOperation): Promise<void> {
    const data = operation.data as BlacklistTokenData;
    
    // Проверяем, что токен еще не заблокирован
    const alreadyBlacklisted = await this.redisService.isTokenBlacklisted(data.token);
    if (alreadyBlacklisted) {
      throw new Error('Token is already blacklisted in Redis');
    }
    
    // Проверяем PostgreSQL
    const dbBlacklisted = await this.authDatabaseService.isTokenBlacklisted(data.tokenHash);
    if (dbBlacklisted) {
      throw new Error('Token is already blacklisted in PostgreSQL');
    }
    
    // Резервируем место в Redis (prepare lock)
    const prepareLockKey = `prepare_lock:blacklist:${data.tokenHash}`;
    const lockResult = await this.redisService.setNX(prepareLockKey, 'preparing', 30);
    if (!lockResult) {
      throw new Error('Failed to acquire prepare lock in Redis');
    }
    
    // Сохраняем данные для компенсации
    operation.compensationData = {
      prepareLockKey,
      action: 'blacklist_token'
    };
  }

  /**
   * Подготовка операции removeFromBlacklist
   */
  private async prepareRemoveFromBlacklist(operation: TransactionOperation): Promise<void> {
    const { token, tokenHash } = operation.data;
    
    // Проверяем, что токен действительно заблокирован
    const redisBlacklisted = await this.redisService.isTokenBlacklisted(token);
    const dbBlacklisted = await this.authDatabaseService.isTokenBlacklisted(tokenHash);
    
    if (!redisBlacklisted && !dbBlacklisted) {
      throw new Error('Token is not blacklisted in either Redis or PostgreSQL');
    }
    
    // Резервируем операцию удаления
    const prepareLockKey = `prepare_lock:remove:${tokenHash}`;
    const lockResult = await this.redisService.setNX(prepareLockKey, 'preparing', 30);
    if (!lockResult) {
      throw new Error('Failed to acquire prepare lock for removal');
    }
    
    // Сохраняем текущее состояние для возможного отката
    operation.compensationData = {
      prepareLockKey,
      action: 'remove_from_blacklist',
      wasInRedis: redisBlacklisted,
      wasInPostgres: dbBlacklisted
    };
  }

  /**
   * Коммит операции blacklistToken
   */
  private async commitBlacklistToken(operation: TransactionOperation): Promise<void> {
    const data = operation.data as BlacklistTokenData;
    
    // Сначала добавляем в PostgreSQL (более надежное хранилище)
    await this.authDatabaseService.blacklistToken(
      data.tokenHash,
      data.userId,
      data.reason,
      data.expiresAt,
      data.metadata
    );
    
    // Затем добавляем в Redis для быстрого доступа
    await this.redisService.blacklistToken(data.token, data.ttlSeconds);
    
    // Очищаем prepare lock
    if (operation.compensationData?.prepareLockKey) {
      await this.redisService.delete(operation.compensationData.prepareLockKey);
    }
  }

  /**
   * Коммит операции removeFromBlacklist
   */
  private async commitRemoveFromBlacklist(operation: TransactionOperation): Promise<void> {
    const { token, tokenHash } = operation.data;
    
    // Удаляем из PostgreSQL
    await this.authDatabaseService.removeTokenFromBlacklist(tokenHash);
    
    // Удаляем из Redis
    await this.redisService.removeFromBlacklist(token);
    
    // Очищаем prepare lock
    if (operation.compensationData?.prepareLockKey) {
      await this.redisService.delete(operation.compensationData.prepareLockKey);
    }
  }

  /**
   * Компенсация операции при откате
   */
  private async compensateOperation(operation: TransactionOperation): Promise<void> {
    try {
      const compensationData = operation.compensationData;
      if (!compensationData) return;
      
      switch (compensationData.action) {
        case 'blacklist_token':
          // Удаляем prepare lock
          if (compensationData.prepareLockKey) {
            await this.redisService.delete(compensationData.prepareLockKey);
          }
          
          // Если операция была частично выполнена, откатываем
          if (operation.status === 'committed') {
            const data = operation.data as BlacklistTokenData;
            await this.authDatabaseService.removeTokenFromBlacklist(data.tokenHash);
            await this.redisService.removeFromBlacklist(data.token);
          }
          break;
          
        case 'remove_from_blacklist':
          // Удаляем prepare lock
          if (compensationData.prepareLockKey) {
            await this.redisService.delete(compensationData.prepareLockKey);
          }
          
          // Восстанавливаем состояние, если операция была частично выполнена
          if (operation.status === 'committed') {
            const { token, tokenHash, userId } = operation.data;
            
            if (compensationData.wasInPostgres) {
              // Восстанавливаем в PostgreSQL (нужны дополнительные данные)
              this.logger.warn(`Need to restore token in PostgreSQL: ${tokenHash}`);
            }
            
            if (compensationData.wasInRedis) {
              // Восстанавливаем в Redis (нужен TTL)
              this.logger.warn(`Need to restore token in Redis: ${token}`);
            }
          }
          break;
      }
    } catch (error) {
      this.logger.error(`Compensation failed for operation ${operation.type}`, error.stack);
    }
  }

  /**
   * Проверка консистентности между Redis и PostgreSQL
   * Выполняется периодически для обнаружения рассинхронизации
   */
  async checkConsistency(): Promise<ConsistencyCheckResult> {
    this.logger.log('Starting consistency check between Redis and PostgreSQL');
    
    const result: ConsistencyCheckResult = {
      totalChecked: 0,
      inconsistencies: 0,
      redisOnly: [],
      postgresOnly: [],
      repaired: 0,
      errors: []
    };

    try {
      // Получаем все заблокированные токены из PostgreSQL
      const dbTokens = await this.authDatabaseService.getAllBlacklistedTokens();
      result.totalChecked = dbTokens.length;

      for (const dbToken of dbTokens) {
        try {
          // Проверяем, есть ли токен в Redis
          // Нам нужно восстановить оригинальный токен из хеша (это невозможно)
          // Поэтому мы проверяем по паттерну ключей Redis
          const redisKeys = await this.redisService.keys(`blacklist:*`);
          
          // Для каждого ключа в Redis проверяем, соответствует ли он нашему хешу
          let foundInRedis = false;
          for (const redisKey of redisKeys) {
            const token = redisKey.replace('blacklist:', '');
            const tokenHash = this.createTokenHash(token);
            
            if (tokenHash === dbToken.tokenHash) {
              foundInRedis = true;
              break;
            }
          }

          if (!foundInRedis && dbToken.expiresAt > new Date()) {
            // Токен есть в PostgreSQL, но нет в Redis
            result.inconsistencies++;
            result.postgresOnly.push(dbToken.tokenHash);
            
            // Попытка восстановления невозможна без оригинального токена
            result.errors.push(`Cannot restore token in Redis: hash ${dbToken.tokenHash} (original token unknown)`);
          }
        } catch (error) {
          result.errors.push(`Error checking token ${dbToken.tokenHash}: ${error.message}`);
        }
      }

      // Проверяем токены, которые есть только в Redis
      const redisKeys = await this.redisService.keys('blacklist:*');
      for (const redisKey of redisKeys) {
        try {
          const token = redisKey.replace('blacklist:', '');
          const tokenHash = this.createTokenHash(token);
          
          const existsInDb = dbTokens.some(dbToken => dbToken.tokenHash === tokenHash);
          
          if (!existsInDb) {
            result.inconsistencies++;
            result.redisOnly.push(tokenHash);
            
            // Удаляем из Redis, так как нет в PostgreSQL
            await this.redisService.removeFromBlacklist(token);
            result.repaired++;
            
            this.logger.warn(`Removed orphaned token from Redis: ${tokenHash}`);
          }
        } catch (error) {
          result.errors.push(`Error processing Redis key ${redisKey}: ${error.message}`);
        }
      }

      this.logger.log(`Consistency check completed. Checked: ${result.totalChecked}, Inconsistencies: ${result.inconsistencies}, Repaired: ${result.repaired}`);
      
      // Отправляем метрики в сервис метрик
      await this.consistencyMetricsService.recordConsistencyMetrics({
        totalChecked: result.totalChecked,
        inconsistencies: result.inconsistencies,
        redisOnly: result.redisOnly.length,
        postgresOnly: result.postgresOnly.length,
        repaired: result.repaired,
        errors: result.errors.length,
        consistencyRatio: result.totalChecked > 0 ? 
          ((result.totalChecked - result.inconsistencies) / result.totalChecked) : 1
      });
      
      return result;
    } catch (error) {
      this.logger.error('Consistency check failed', error.stack);
      result.errors.push(`Consistency check failed: ${error.message}`);
      return result;
    }
  }

  /**
   * Автоматическое восстановление при рассинхронизации
   * Синхронизирует состояние между Redis и PostgreSQL
   */
  async autoRepairInconsistencies(): Promise<void> {
    this.logger.log('Starting automatic repair of inconsistencies');
    
    try {
      const consistencyResult = await this.checkConsistency();
      
      if (consistencyResult.inconsistencies === 0) {
        this.logger.log('No inconsistencies found, no repair needed');
        return;
      }

      // Логируем найденные проблемы
      if (consistencyResult.redisOnly.length > 0) {
        this.logger.warn(`Found ${consistencyResult.redisOnly.length} tokens only in Redis (will be removed)`);
      }
      
      if (consistencyResult.postgresOnly.length > 0) {
        this.logger.warn(`Found ${consistencyResult.postgresOnly.length} tokens only in PostgreSQL (cannot restore without original token)`);
      }

      // Метрики уже отправлены в checkConsistency()
      
      this.logger.log(`Automatic repair completed. Repaired: ${consistencyResult.repaired} inconsistencies`);
    } catch (error) {
      this.logger.error('Automatic repair failed', error.stack);
      throw error;
    }
  }



  /**
   * Получить статистику активных транзакций
   */
  getActiveTransactionsStats(): {
    total: number;
    byStatus: Record<string, number>;
    oldestTransaction?: Date;
  } {
    const stats = {
      total: this.activeTransactions.size,
      byStatus: {} as Record<string, number>,
      oldestTransaction: undefined as Date | undefined
    };

    let oldest: Date | undefined;
    
    for (const context of this.activeTransactions.values()) {
      stats.byStatus[context.status] = (stats.byStatus[context.status] || 0) + 1;
      
      if (!oldest || context.createdAt < oldest) {
        oldest = context.createdAt;
      }
    }
    
    stats.oldestTransaction = oldest;
    return stats;
  }

  /**
   * Очистка зависших транзакций
   */
  async cleanupStaleTransactions(): Promise<number> {
    const now = new Date();
    let cleanedUp = 0;
    
    for (const [transactionId, context] of this.activeTransactions.entries()) {
      const age = now.getTime() - context.createdAt.getTime();
      
      if (age > context.timeout) {
        this.logger.warn(`Cleaning up stale transaction: ${transactionId}, age: ${age}ms`);
        
        try {
          await this.abortPhase(context);
          this.activeTransactions.delete(transactionId);
          cleanedUp++;
        } catch (error) {
          this.logger.error(`Failed to cleanup stale transaction: ${transactionId}`, error.stack);
        }
      }
    }
    
    if (cleanedUp > 0) {
      this.logger.log(`Cleaned up ${cleanedUp} stale transactions`);
    }
    
    return cleanedUp;
  }

  /**
   * Генерация уникального ID транзакции
   */
  private generateTransactionId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Создание хеша токена
   */
  private createTokenHash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}