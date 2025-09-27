#!/usr/bin/env node

/**
 * Production Configuration Validation Script
 * Validates that all required environment variables and configurations are set for production deployment
 */

const fs = require('fs');
const path = require('path');

// Required environment variables for production
const REQUIRED_ENV_VARS = [
  'NODE_ENV',
  'DATABASE_PASSWORD',
  'JWT_SECRET',
  'CORS_ORIGIN',
  'REDIS_PASSWORD',
];

// Recommended environment variables
const RECOMMENDED_ENV_VARS = [
  'LOG_LEVEL',
  'RATE_LIMIT_LIMIT',
  'CACHE_TTL',
  'SHUTDOWN_TIMEOUT',
  'METRICS_ENABLED',
  'NOTIFICATION_SERVICE_URL',
  'LIBRARY_SERVICE_URL',
  'PAYMENT_SERVICE_URL',
  'REVIEW_SERVICE_URL',
  'SOCIAL_SERVICE_URL',
];

// Security validations
const SECURITY_CHECKS = [
  {
    name: 'JWT_SECRET length',
    check: () => process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32,
    message: 'JWT_SECRET should be at least 32 characters long',
  },
  {
    name: 'NODE_ENV is production',
    check: () => process.env.NODE_ENV === 'production',
    message: 'NODE_ENV must be set to "production"',
  },
  {
    name: 'Database SSL enabled',
    check: () => process.env.DATABASE_SSL === 'true',
    message: 'DATABASE_SSL should be enabled in production',
  },
  {
    name: 'Helmet enabled',
    check: () => process.env.HELMET_ENABLED !== 'false',
    message: 'HELMET_ENABLED should not be disabled in production',
  },
  {
    name: 'Compression enabled',
    check: () => process.env.COMPRESSION_ENABLED !== 'false',
    message: 'COMPRESSION_ENABLED should not be disabled in production',
  },
];

function validateEnvironmentVariables() {
  console.log('🔍 Validating environment variables...\n');

  const missing = [];
  const warnings = [];

  // Check required variables
  REQUIRED_ENV_VARS.forEach(varName => {
    if (!process.env[varName]) {
      missing.push(varName);
    } else {
      console.log(`✅ ${varName}: Set`);
    }
  });

  // Check recommended variables
  RECOMMENDED_ENV_VARS.forEach(varName => {
    if (!process.env[varName]) {
      warnings.push(varName);
    } else {
      console.log(`✅ ${varName}: Set`);
    }
  });

  if (missing.length > 0) {
    console.log('\n❌ Missing required environment variables:');
    missing.forEach(varName => console.log(`   - ${varName}`));
    return false;
  }

  if (warnings.length > 0) {
    console.log('\n⚠️  Missing recommended environment variables:');
    warnings.forEach(varName => console.log(`   - ${varName}`));
  }

  return true;
}

function validateSecurityConfiguration() {
  console.log('\n🔒 Validating security configuration...\n');

  let allPassed = true;

  SECURITY_CHECKS.forEach(check => {
    if (check.check()) {
      console.log(`✅ ${check.name}: Passed`);
    } else {
      console.log(`❌ ${check.name}: Failed - ${check.message}`);
      allPassed = false;
    }
  });

  return allPassed;
}

function validateFileStructure() {
  console.log('\n📁 Validating file structure...\n');

  const requiredFiles = [
    'dist/main.js',
    'package.json',
    '.env.production',
    'monitoring/prometheus.yml',
    'monitoring/production-alerts.yml',
  ];

  const requiredDirs = [
    'logs',
    'dist',
    'monitoring',
  ];

  let allExists = true;

  // Check files
  requiredFiles.forEach(filePath => {
    if (fs.existsSync(filePath)) {
      console.log(`✅ File exists: ${filePath}`);
    } else {
      console.log(`❌ Missing file: ${filePath}`);
      allExists = false;
    }
  });

  // Check directories (create if missing)
  requiredDirs.forEach(dirPath => {
    if (fs.existsSync(dirPath)) {
      console.log(`✅ Directory exists: ${dirPath}`);
    } else {
      console.log(`⚠️  Creating directory: ${dirPath}`);
      try {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`✅ Created directory: ${dirPath}`);
      } catch (error) {
        console.log(`❌ Failed to create directory: ${dirPath} - ${error.message}`);
        allExists = false;
      }
    }
  });

  return allExists;
}

function validateDatabaseMigrations() {
  console.log('\n🗄️  Validating database setup...\n');

  // Check if migration files exist
  const migrationDir = 'src/migrations';
  if (fs.existsSync(migrationDir)) {
    const migrations = fs.readdirSync(migrationDir).filter(file => file.endsWith('.ts'));
    console.log(`✅ Found ${migrations.length} migration files`);
    migrations.forEach(migration => console.log(`   - ${migration}`));
    return true;
  } else {
    console.log('❌ Migration directory not found');
    return false;
  }
}

function main() {
  console.log('🚀 Achievement Service Production Configuration Validation\n');
  console.log('=' .repeat(60));

  const results = [
    validateEnvironmentVariables(),
    validateSecurityConfiguration(),
    validateFileStructure(),
    validateDatabaseMigrations(),
  ];

  console.log('\n' + '=' .repeat(60));

  if (results.every(result => result)) {
    console.log('🎉 All validation checks passed! Ready for production deployment.');
    process.exit(0);
  } else {
    console.log('❌ Some validation checks failed. Please fix the issues before deploying to production.');
    process.exit(1);
  }
}

// Load environment variables from .env.production if it exists
const envPath = '.env.production';
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').replace(/^['"]|['"]$/g, '');
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

main();