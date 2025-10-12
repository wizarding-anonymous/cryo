#!/usr/bin/env ts-node

/**
 * Скрипт для проверки консистентности данных токенов между Redis и PostgreSQL
 * 
 * Использование:
 * npm run consistency:check - проверка консистентности
 * npm run consistency:repair - проверка и автоматическое восстановление
 * npm run consistency:report - детальный отчет
 * 
 * Переменные окружения:
 * CONSISTENCY_CHECK_MODE=check|repair|report
 * CONSISTENCY_CHECK_VERBOSE=true|false
 */

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConsistencyCheckModule } from '../src/common/distributed-transaction/consistency-check.module';
import { DistributedTransactionService } from '../src/common/distributed-transaction/distributed-transaction.service';

interface ConsistencyCheckOptions {
  mode: 'check' | 'repair' | 'report';
  verbose: boolean;
  outputFormat: 'console' | 'json' | 'csv';
}

class ConsistencyCheckScript {
  private readonly logger = new Logger('ConsistencyCheckScript');
  private distributedTransactionService: DistributedTransactionService;

  async run(): Promise<void> {
    const options = this.parseOptions();
    
    this.logger.log(`Starting consistency check in ${options.mode} mode`);
    
    let app;
    try {
      // Создаем NestJS приложение для доступа к сервисам
      app = await NestFactory.createApplicationContext(ConsistencyCheckModule, {
        logger: options.verbose ? ['log', 'error', 'warn', 'debug'] : ['error', 'warn']
      });

      this.distributedTransactionService = app.get(DistributedTransactionService);
      
      switch (options.mode) {
        case 'check':
          await this.performCheck(options);
          break;
        case 'repair':
          await this.performRepair(options);
          break;
        case 'report':
          await this.generateReport(options);
          break;
      }
      
    } catch (error) {
      if (error.message?.includes('Unable to connect to the database') || 
          error.message?.includes('ECONNREFUSED') ||
          error.message?.includes('AggregateError')) {
        this.logger.error('❌ Cannot connect to database or Redis. Please ensure services are running:');
        this.logger.error('   - PostgreSQL: Check if database is running on configured port');
        this.logger.error('   - Redis: Check if Redis is running and accessible');
        this.logger.error('   - Environment: Verify DATABASE_URL and REDIS_URL are correct');
        process.exit(2); // Exit code 2 for connection issues
      } else {
        this.logger.error('Consistency check script failed', error.stack);
        process.exit(1);
      }
    } finally {
      if (app) {
        await app.close();
      }
    }
  }

  private parseOptions(): ConsistencyCheckOptions {
    const mode = (process.env.CONSISTENCY_CHECK_MODE || 'check') as 'check' | 'repair' | 'report';
    const verbose = process.env.CONSISTENCY_CHECK_VERBOSE === 'true';
    const outputFormat = (process.env.CONSISTENCY_CHECK_OUTPUT || 'console') as 'console' | 'json' | 'csv';
    
    return { mode, verbose, outputFormat };
  }

  private async performCheck(options: ConsistencyCheckOptions): Promise<void> {
    this.logger.log('Performing consistency check...');
    
    const result = await this.distributedTransactionService.checkConsistency();
    
    this.outputResult(result, options);
    
    if (result.inconsistencies > 0) {
      this.logger.warn(`Found ${result.inconsistencies} inconsistencies`);
      process.exit(1);
    } else {
      this.logger.log('No inconsistencies found');
      process.exit(0);
    }
  }

  private async performRepair(options: ConsistencyCheckOptions): Promise<void> {
    this.logger.log('Performing consistency check and repair...');
    
    const checkResult = await this.distributedTransactionService.checkConsistency();
    this.outputResult(checkResult, options);
    
    if (checkResult.inconsistencies > 0) {
      this.logger.log(`Found ${checkResult.inconsistencies} inconsistencies, starting repair...`);
      
      await this.distributedTransactionService.autoRepairInconsistencies();
      
      // Повторная проверка после восстановления
      const afterRepairResult = await this.distributedTransactionService.checkConsistency();
      
      this.logger.log('Post-repair consistency check:');
      this.outputResult(afterRepairResult, options);
      
      if (afterRepairResult.inconsistencies === 0) {
        this.logger.log('All inconsistencies have been repaired successfully');
        process.exit(0);
      } else {
        this.logger.error(`${afterRepairResult.inconsistencies} inconsistencies remain after repair`);
        process.exit(1);
      }
    } else {
      this.logger.log('No inconsistencies found, no repair needed');
      process.exit(0);
    }
  }

  private async generateReport(options: ConsistencyCheckOptions): Promise<void> {
    this.logger.log('Generating detailed consistency report...');
    
    const result = await this.distributedTransactionService.checkConsistency();
    const transactionStats = this.distributedTransactionService.getActiveTransactionsStats();
    
    const report = {
      timestamp: new Date().toISOString(),
      consistency: result,
      activeTransactions: transactionStats,
      summary: {
        status: result.inconsistencies === 0 ? 'CONSISTENT' : 'INCONSISTENT',
        consistencyRatio: result.totalChecked > 0 ? 
          ((result.totalChecked - result.inconsistencies) / result.totalChecked) : 1,
        criticalIssues: result.inconsistencies > 10,
        requiresAttention: result.errors.length > 0 || result.inconsistencies > 0
      }
    };
    
    this.outputReport(report, options);
    
    process.exit(result.inconsistencies > 0 ? 1 : 0);
  }

  private outputResult(result: any, options: ConsistencyCheckOptions): void {
    switch (options.outputFormat) {
      case 'json':
        console.log(JSON.stringify(result, null, 2));
        break;
      case 'csv':
        this.outputCSV(result);
        break;
      default:
        this.outputConsole(result, options.verbose);
    }
  }

  private outputReport(report: any, options: ConsistencyCheckOptions): void {
    switch (options.outputFormat) {
      case 'json':
        console.log(JSON.stringify(report, null, 2));
        break;
      case 'csv':
        this.outputReportCSV(report);
        break;
      default:
        this.outputReportConsole(report, options.verbose);
    }
  }

  private outputConsole(result: any, verbose: boolean): void {
    console.log('\n=== CONSISTENCY CHECK RESULTS ===');
    console.log(`Total tokens checked: ${result.totalChecked}`);
    console.log(`Inconsistencies found: ${result.inconsistencies}`);
    console.log(`Tokens only in Redis: ${result.redisOnly.length}`);
    console.log(`Tokens only in PostgreSQL: ${result.postgresOnly.length}`);
    console.log(`Automatically repaired: ${result.repaired}`);
    console.log(`Errors encountered: ${result.errors.length}`);
    
    if (result.inconsistencies > 0) {
      console.log('\n=== INCONSISTENCY DETAILS ===');
      
      if (result.redisOnly.length > 0) {
        console.log(`\nTokens only in Redis (${result.redisOnly.length}):`);
        result.redisOnly.forEach((hash: string, index: number) => {
          console.log(`  ${index + 1}. ${hash}`);
        });
      }
      
      if (result.postgresOnly.length > 0) {
        console.log(`\nTokens only in PostgreSQL (${result.postgresOnly.length}):`);
        result.postgresOnly.forEach((hash: string, index: number) => {
          console.log(`  ${index + 1}. ${hash}`);
        });
      }
    }
    
    if (result.errors.length > 0 && verbose) {
      console.log('\n=== ERRORS ===');
      result.errors.forEach((error: string, index: number) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }
    
    const consistencyRatio = result.totalChecked > 0 ? 
      ((result.totalChecked - result.inconsistencies) / result.totalChecked * 100).toFixed(2) : '100.00';
    
    console.log(`\nConsistency ratio: ${consistencyRatio}%`);
    console.log(`Status: ${result.inconsistencies === 0 ? '✅ CONSISTENT' : '❌ INCONSISTENT'}`);
  }

  private outputReportConsole(report: any, verbose: boolean): void {
    console.log('\n=== DETAILED CONSISTENCY REPORT ===');
    console.log(`Generated at: ${report.timestamp}`);
    console.log(`Overall status: ${report.summary.status}`);
    console.log(`Consistency ratio: ${(report.summary.consistencyRatio * 100).toFixed(2)}%`);
    console.log(`Critical issues: ${report.summary.criticalIssues ? '⚠️  YES' : '✅ NO'}`);
    console.log(`Requires attention: ${report.summary.requiresAttention ? '⚠️  YES' : '✅ NO'}`);
    
    this.outputConsole(report.consistency, verbose);
    
    console.log('\n=== ACTIVE TRANSACTIONS ===');
    console.log(`Total active: ${report.activeTransactions.total}`);
    if (report.activeTransactions.total > 0) {
      console.log('Status breakdown:');
      Object.entries(report.activeTransactions.byStatus).forEach(([status, count]) => {
        console.log(`  ${status}: ${count}`);
      });
      
      if (report.activeTransactions.oldestTransaction) {
        const age = Date.now() - new Date(report.activeTransactions.oldestTransaction).getTime();
        console.log(`Oldest transaction age: ${Math.round(age / 1000)}s`);
      }
    }
  }

  private outputCSV(result: any): void {
    console.log('metric,value');
    console.log(`total_checked,${result.totalChecked}`);
    console.log(`inconsistencies,${result.inconsistencies}`);
    console.log(`redis_only,${result.redisOnly.length}`);
    console.log(`postgres_only,${result.postgresOnly.length}`);
    console.log(`repaired,${result.repaired}`);
    console.log(`errors,${result.errors.length}`);
    
    const consistencyRatio = result.totalChecked > 0 ? 
      ((result.totalChecked - result.inconsistencies) / result.totalChecked) : 1;
    console.log(`consistency_ratio,${consistencyRatio}`);
  }

  private outputReportCSV(report: any): void {
    console.log('timestamp,status,consistency_ratio,critical_issues,requires_attention,total_checked,inconsistencies,active_transactions');
    console.log([
      report.timestamp,
      report.summary.status,
      report.summary.consistencyRatio,
      report.summary.criticalIssues,
      report.summary.requiresAttention,
      report.consistency.totalChecked,
      report.consistency.inconsistencies,
      report.activeTransactions.total
    ].join(','));
  }
}

// Запуск скрипта
if (require.main === module) {
  const script = new ConsistencyCheckScript();
  script.run().catch((error) => {
    console.error('Script execution failed:', error);
    process.exit(1);
  });
}

export { ConsistencyCheckScript };