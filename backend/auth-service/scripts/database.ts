#!/usr/bin/env ts-node

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { DatabaseCliService } from '../src/database/database-cli.service';

const logger = new Logger('DatabaseCLI');

async function main() {
  const command = process.argv[2];
  
  if (!command) {
    logger.error('Usage: npm run db:cli <command>');
    logger.log('Available commands:');
    logger.log('  init     - Initialize database and run migrations');
    logger.log('  status   - Show database status');
    logger.log('  reset    - Reset database (development only)');
    logger.log('  test     - Test database performance');
    process.exit(1);
  }

  try {
    // Create NestJS application context
    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['error', 'warn', 'log'],
    });

    const databaseCli = app.get(DatabaseCliService);

    switch (command) {
      case 'init':
        await databaseCli.initializeDatabase();
        break;
      
      case 'status':
        await databaseCli.showStatus();
        break;
      
      case 'reset':
        await databaseCli.resetDatabase();
        break;
      
      case 'test':
        await databaseCli.testPerformance();
        break;
      
      default:
        logger.error(`Unknown command: ${command}`);
        process.exit(1);
    }

    await app.close();
    logger.log('Database CLI operation completed');
    process.exit(0);
  } catch (error) {
    logger.error('Database CLI operation failed', error);
    process.exit(1);
  }
}

main();