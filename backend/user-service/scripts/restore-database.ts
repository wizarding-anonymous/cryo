#!/usr/bin/env ts-node

/**
 * Database Restore Script for User Service
 * Restores the user database from a backup file
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { config } from 'dotenv';
import { join } from 'path';
import { existsSync, readdirSync } from 'fs';

const execAsync = promisify(exec);

// Load environment variables
config({ path: join(__dirname, '../.env.docker') });

interface RestoreOptions {
  backupFile?: string;
  backupDir?: string;
  dropExisting?: boolean;
  verbose?: boolean;
}

async function restoreDatabase(options: RestoreOptions = {}) {
  const {
    backupDir = join(__dirname, '../backups'),
    dropExisting = false,
    verbose = true,
  } = options;

  console.log('🔄 Starting database restore...');

  // Database connection parameters
  const dbHost = process.env.DB_HOST || 'localhost';
  const dbPort = process.env.DB_PORT || '5433';
  const dbUser = process.env.DB_USER || 'user_service';
  const dbPassword = process.env.DB_PASSWORD || 'user_password';
  const dbName = process.env.DB_NAME || 'user_db';

  let backupFile = options.backupFile;

  // If no backup file specified, find the latest one
  if (!backupFile) {
    if (!existsSync(backupDir)) {
      console.error(`❌ Backup directory does not exist: ${backupDir}`);
      process.exit(1);
    }

    const backupFiles = readdirSync(backupDir)
      .filter(file => file.endsWith('.sql') || file.endsWith('.sql.gz'))
      .sort()
      .reverse();

    if (backupFiles.length === 0) {
      console.error(`❌ No backup files found in: ${backupDir}`);
      process.exit(1);
    }

    backupFile = join(backupDir, backupFiles[0]);
    console.log(`📄 Using latest backup: ${backupFiles[0]}`);
  }

  if (!existsSync(backupFile)) {
    console.error(`❌ Backup file does not exist: ${backupFile}`);
    process.exit(1);
  }

  try {
    // Set PGPASSWORD environment variable
    const env = { ...process.env, PGPASSWORD: dbPassword };

    // Drop existing database if requested
    if (dropExisting) {
      console.log('🗑️  Dropping existing database...');
      const dropCommand = `psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d postgres -c "DROP DATABASE IF EXISTS ${dbName};"`;
      await execAsync(dropCommand, { env });
      
      console.log('🏗️  Creating new database...');
      const createCommand = `psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d postgres -c "CREATE DATABASE ${dbName};"`;
      await execAsync(createCommand, { env });
    }

    // Build restore command
    const isCompressed = backupFile.endsWith('.gz');
    const restoreCommand = isCompressed
      ? `gunzip -c "${backupFile}" | psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName}`
      : `psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} -f "${backupFile}"`;

    if (verbose) {
      console.log(`🔄 Running restore command...`);
      console.log(`📍 Backup file: ${backupFile}`);
      console.log(`🎯 Target database: ${dbName}`);
    }

    const { stdout, stderr } = await execAsync(restoreCommand, { env });

    if (stderr && !stderr.includes('NOTICE') && !stderr.includes('already exists')) {
      console.warn('⚠️  Restore warnings:', stderr);
    }

    if (verbose && stdout) {
      console.log('📋 Restore output:', stdout);
    }

    console.log('✅ Database restore completed successfully!');

    // Verify restore by checking table count
    const verifyCommand = `psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"`;
    const { stdout: tableCount } = await execAsync(verifyCommand, { env });
    console.log(`📊 Tables restored: ${tableCount.trim()}`);

  } catch (error) {
    console.error('❌ Error restoring database:', error);
    throw error;
  }
}

// List available backups
async function listBackups(backupDir: string = join(__dirname, '../backups')) {
  if (!existsSync(backupDir)) {
    console.log('📁 No backup directory found');
    return;
  }

  const backupFiles = readdirSync(backupDir)
    .filter(file => file.endsWith('.sql') || file.endsWith('.sql.gz'))
    .sort()
    .reverse();

  if (backupFiles.length === 0) {
    console.log('📄 No backup files found');
    return;
  }

  console.log('📋 Available backups:');
  for (const file of backupFiles) {
    const filePath = join(backupDir, file);
    const { stdout } = await execAsync(`ls -lh "${filePath}"`);
    const [, , , , size, , , , name] = stdout.trim().split(/\s+/);
    console.log(`  - ${name} (${size})`);
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const options: RestoreOptions = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--backup-file':
        options.backupFile = args[++i];
        break;
      case '--backup-dir':
        options.backupDir = args[++i];
        break;
      case '--drop-existing':
        options.dropExisting = true;
        break;
      case '--quiet':
        options.verbose = false;
        break;
      case '--list':
        await listBackups(options.backupDir);
        process.exit(0);
      case '--help':
        console.log(`
Database Restore Script for User Service

Usage: npm run db:restore [options]

Options:
  --backup-file <file>  Specific backup file to restore
  --backup-dir <dir>    Directory to search for backups (default: ./backups)
  --drop-existing       Drop existing database before restore
  --quiet               Suppress verbose output
  --list                List available backup files
  --help               Show this help message

Examples:
  npm run db:restore
  npm run db:restore -- --list
  npm run db:restore -- --backup-file /path/to/backup.sql
  npm run db:restore -- --drop-existing
        `);
        process.exit(0);
    }
  }

  try {
    await restoreDatabase(options);
  } catch (error) {
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { restoreDatabase };