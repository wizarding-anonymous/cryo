#!/usr/bin/env ts-node

/**
 * Демо-версия скрипта проверки консистентности
 * Работает без подключения к реальным сервисам, показывает примеры вывода
 * 
 * Использование:
 * npm run consistency:demo
 */

import { Logger } from '@nestjs/common';

interface ConsistencyCheckOptions {
  mode: 'check' | 'repair' | 'report';
  verbose: boolean;
  outputFormat: 'console' | 'json' | 'csv';
}

interface MockConsistencyResult {
  totalChecked: number;
  inconsistencies: number;
  redisOnly: string[];
  postgresOnly: string[];
  repaired: number;
  errors: string[];
}

class ConsistencyCheckDemo {
  private readonly logger = new Logger('ConsistencyCheckDemo');

  async run(): Promise<void> {
    const options = this.parseOptions();
    
    this.logger.log(`🎭 Starting DEMO consistency check in ${options.mode} mode`);
    this.logger.log('📝 This is a demonstration without real database connections');
    
    switch (options.mode) {
      case 'check':
        await this.performDemoCheck(options);
        break;
      case 'repair':
        await this.performDemoRepair(options);
        break;
      case 'report':
        await this.generateDemoReport(options);
        break;
    }
  }

  private parseOptions(): ConsistencyCheckOptions {
    const mode = (process.env.CONSISTENCY_CHECK_MODE || 'check') as 'check' | 'repair' | 'report';
    const verbose = process.env.CONSISTENCY_CHECK_VERBOSE === 'true';
    const outputFormat = (process.env.CONSISTENCY_CHECK_OUTPUT || 'console') as 'console' | 'json' | 'csv';
    
    return { mode, verbose, outputFormat };
  }

  private async performDemoCheck(options: ConsistencyCheckOptions): Promise<void> {
    this.logger.log('🔍 Performing demo consistency check...');
    
    // Simulate checking process
    await this.delay(1000);
    this.logger.log('📊 Checking Redis tokens...');
    await this.delay(500);
    this.logger.log('🗄️  Checking PostgreSQL tokens...');
    await this.delay(500);
    this.logger.log('🔄 Comparing consistency...');
    await this.delay(300);
    
    const result: MockConsistencyResult = {
      totalChecked: 1250,
      inconsistencies: 3,
      redisOnly: ['token_hash_abc123', 'token_hash_def456'],
      postgresOnly: ['token_hash_ghi789'],
      repaired: 0,
      errors: []
    };

    this.outputResult(result, options);
    
    if (result.inconsistencies > 0) {
      this.logger.warn(`⚠️  Found ${result.inconsistencies} inconsistencies`);
      process.exit(1);
    } else {
      this.logger.log('✅ No inconsistencies found');
      process.exit(0);
    }
  }

  private async performDemoRepair(options: ConsistencyCheckOptions): Promise<void> {
    this.logger.log('🔧 Performing demo consistency check and repair...');
    
    // Simulate initial check
    await this.delay(1000);
    const initialResult: MockConsistencyResult = {
      totalChecked: 1250,
      inconsistencies: 3,
      redisOnly: ['token_hash_abc123', 'token_hash_def456'],
      postgresOnly: ['token_hash_ghi789'],
      repaired: 0,
      errors: []
    };

    this.outputResult(initialResult, options);
    
    if (initialResult.inconsistencies > 0) {
      this.logger.log(`🔧 Found ${initialResult.inconsistencies} inconsistencies, starting repair...`);
      
      await this.delay(800);
      this.logger.log('🗑️  Removing orphaned Redis tokens...');
      await this.delay(400);
      this.logger.log('⚠️  Cannot restore PostgreSQL-only tokens (original token unknown)');
      await this.delay(200);
      
      // Simulate post-repair check
      const afterRepairResult: MockConsistencyResult = {
        totalChecked: 1250,
        inconsistencies: 1,
        redisOnly: [],
        postgresOnly: ['token_hash_ghi789'],
        repaired: 2,
        errors: ['Cannot restore token in Redis: hash token_hash_ghi789 (original token unknown)']
      };
      
      this.logger.log('🔍 Post-repair consistency check:');
      this.outputResult(afterRepairResult, options);
      
      if (afterRepairResult.inconsistencies === 0) {
        this.logger.log('✅ All inconsistencies have been repaired successfully');
        process.exit(0);
      } else {
        this.logger.error(`❌ ${afterRepairResult.inconsistencies} inconsistencies remain after repair`);
        process.exit(1);
      }
    } else {
      this.logger.log('✅ No inconsistencies found, no repair needed');
      process.exit(0);
    }
  }

  private async generateDemoReport(options: ConsistencyCheckOptions): Promise<void> {
    this.logger.log('📋 Generating detailed demo consistency report...');
    
    await this.delay(1200);
    
    const result: MockConsistencyResult = {
      totalChecked: 1250,
      inconsistencies: 3,
      redisOnly: ['token_hash_abc123', 'token_hash_def456'],
      postgresOnly: ['token_hash_ghi789'],
      repaired: 0,
      errors: []
    };
    
    const transactionStats = {
      total: 2,
      byStatus: { preparing: 1, committed: 1 },
      oldestTransaction: new Date(Date.now() - 30000)
    };
    
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

  private outputResult(result: MockConsistencyResult, options: ConsistencyCheckOptions): void {
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

  private outputConsole(result: MockConsistencyResult, verbose: boolean): void {
    console.log('\n=== DEMO CONSISTENCY CHECK RESULTS ===');
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
    console.log('\n=== DETAILED DEMO CONSISTENCY REPORT ===');
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

  private outputCSV(result: MockConsistencyResult): void {
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

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Запуск демо-скрипта
if (require.main === module) {
  const demo = new ConsistencyCheckDemo();
  demo.run().catch((error) => {
    console.error('Demo script execution failed:', error);
    process.exit(1);
  });
}

export { ConsistencyCheckDemo };