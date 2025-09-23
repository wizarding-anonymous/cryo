#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

/**
 * Production-ready migration runner script
 * This script ensures migrations are run safely in production
 */

console.log('🔄 Starting migration process...');

try {
  // Build the project first
  console.log('📦 Building project...');
  execSync('npm run build', { stdio: 'inherit', cwd: process.cwd() });

  // Check pending migrations
  console.log('🔍 Checking for pending migrations...');
  try {
    execSync('npm run typeorm -- migration:show', { stdio: 'inherit', cwd: process.cwd() });
  } catch (error) {
    console.log('ℹ️  No migrations to show or database not accessible');
  }

  // Run migrations
  console.log('🚀 Running migrations...');
  execSync('npm run typeorm -- migration:run', { stdio: 'inherit', cwd: process.cwd() });

  console.log('✅ Migrations completed successfully!');
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
}