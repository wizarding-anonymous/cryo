#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

/**
 * Production migration runner script
 * This script ensures migrations are run safely in production environments
 */

async function runMigrations() {
  try {
    console.log('Starting database migrations...');
    
    // Ensure the application is built
    console.log('Building application...');
    execSync('npm run build', { stdio: 'inherit' });
    
    // Run migrations
    console.log('Running migrations...');
    execSync('npm run typeorm -- migration:run', { stdio: 'inherit' });
    
    console.log('Migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
}

// Only run if this script is executed directly
if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };