#!/usr/bin/env ts-node

/**
 * Database Backup Script for User Service
 * Creates a backup of the user database
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { config } from 'dotenv';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const execAsync = promisify(exec);

// Load environment variables
config({ path: join(__dirname, '../.env.docker') });

interface BackupOptions {
  outputDir?: string;
  filename?: string;
  compress?: boolean;
  includeData?: boolean;
}

async function backupDatabase(options: BackupOptions = {}) {
  const {
    outputDir = join(__dirname, '../backups'),
    filename = `user_db_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.sql`,
    compress = true,
    includeData = true,
  } = options;

  console.log('💾 Starting database backup...');

  // Ensure backup directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
    console.log(`📁 Created backup directory: ${outputDir}`);
  }

  const backupPath = join(outputDir, filename);
  const compressedPath = compress ? `${backupPath}.gz` : backupPath;

  // Database connection parameters
  const dbHost = process.env.DB_HOST || 'localhost';
  const dbPort = process.env.DB_PORT || '5433';
  const dbUser = process.env.DB_USER || 'user_service';
  const dbPassword = process.env.DB_PASSWORD || 'user_password';
  const dbName = process.env.DB_NAME || 'user_db';

  try {
    // Build pg_dump command
    const pgDumpOptions = [
      '--host', dbHost,
      '--port', dbPort,
      '--username', dbUser,
      '--dbname', dbName,
      '--verbose',
      '--clean',
      '--if-exists',
      '--create',
    ];

    if (!includeData) {
      pgDumpOptions.push('--schema-only');
    }

    const pgDumpCommand = `pg_dump ${pgDumpOptions.join(' ')}`;
    const fullCommand = compress 
      ? `${pgDumpCommand} | gzip > "${compressedPath}"`
      : `${pgDumpCommand} > "${backupPath}"`;

    console.log(`🔄 Running backup command...`);
    console.log(`📍 Output file: ${compressedPath}`);

    // Set PGPASSWORD environment variable
    const env = { ...process.env, PGPASSWORD: dbPassword };

    const { stdout, stderr } = await execAsync(fullCommand, { env });

    if (stderr && !stderr.includes('NOTICE')) {
      console.warn('⚠️  Backup warnings:', stderr);
    }

    console.log('✅ Database backup completed successfully!');
    console.log(`📄 Backup file: ${compressedPath}`);

    // Get file size
    const { stdout: sizeOutput } = await execAsync(`ls -lh "${compressedPath}"`);
    const fileSize = sizeOutput.split(/\s+/)[4];
    console.log(`📊 Backup size: ${fileSize}`);

    return compressedPath;

  } catch (error) {
    console.error('❌ Error creating database backup:', error);
    throw error;
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const options: BackupOptions = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--output-dir':
        options.outputDir = args[++i];
        break;
      case '--filename':
        options.filename = args[++i];
        break;
      case '--no-compress':
        options.compress = false;
        break;
      case '--schema-only':
        options.includeData = false;
        break;
      case '--help':
        console.log(`
Database Backup Script for User Service

Usage: npm run db:backup [options]

Options:
  --output-dir <dir>    Output directory for backup files (default: ./backups)
  --filename <name>     Custom filename for backup (default: auto-generated)
  --no-compress         Don't compress the backup file
  --schema-only         Backup schema only, exclude data
  --help               Show this help message

Examples:
  npm run db:backup
  npm run db:backup -- --output-dir /tmp/backups
  npm run db:backup -- --filename my_backup.sql --no-compress
  npm run db:backup -- --schema-only
        `);
        process.exit(0);
    }
  }

  try {
    await backupDatabase(options);
  } catch (error) {
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { backupDatabase };