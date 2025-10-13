#!/usr/bin/env node

/**
 * Configuration Validation Script for Auth Service
 * 
 * This script validates that all required environment variables are set
 * and have appropriate values for the current environment.
 */

const fs = require('fs');
const path = require('path');

// Required environment variables by category
const REQUIRED_CONFIG = {
  server: [
    'PORT',
    'NODE_ENV'
  ],
  jwt: [
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'JWT_EXPIRES_IN',
    'JWT_REFRESH_EXPIRES_IN',
    'JWT_ISSUER',
    'JWT_AUDIENCE',
    'JWT_ALGORITHM'
  ],
  database: [
    'DATABASE_HOST',
    'DATABASE_PORT',
    'DATABASE_NAME',
    'DATABASE_USERNAME',
    'DATABASE_PASSWORD',
    'DATABASE_URL'
  ],
  redis: [
    'REDIS_HOST',
    'REDIS_PORT',
    'REDIS_DB',
    'REDIS_URL',
    'REDIS_TTL'
  ],
  services: [
    'USER_SERVICE_URL',
    'SECURITY_SERVICE_URL',
    'NOTIFICATION_SERVICE_URL'
  ],
  circuitBreaker: [
    'CIRCUIT_BREAKER_TIMEOUT',
    'CIRCUIT_BREAKER_ERROR_THRESHOLD',
    'CIRCUIT_BREAKER_RESET_TIMEOUT'
  ],
  session: [
    'SESSION_CLEANUP_INTERVAL',
    'SESSION_MAX_AGE',
    'MAX_SESSIONS_PER_USER'
  ],
  rateLimit: [
    'RATE_LIMIT_WINDOW',
    'RATE_LIMIT_MAX_REQUESTS',
    'LOGIN_RATE_LIMIT_WINDOW',
    'LOGIN_RATE_LIMIT_MAX_ATTEMPTS'
  ]
};

// Environment-specific validation rules
const VALIDATION_RULES = {
  production: {
    JWT_SECRET: (value) => value && value.length >= 32 && !value.includes('dev') && !value.includes('test'),
    JWT_REFRESH_SECRET: (value) => value && value.length >= 32 && !value.includes('dev') && !value.includes('test'),
    JWT_EXPIRES_IN: (value) => ['15m', '30m', '1h'].includes(value),
    BCRYPT_ROUNDS: (value) => parseInt(value) >= 12,
    LOG_LEVEL: (value) => ['error', 'warn'].includes(value)
  },
  staging: {
    JWT_SECRET: (value) => value && value.length >= 24,
    JWT_REFRESH_SECRET: (value) => value && value.length >= 24,
    BCRYPT_ROUNDS: (value) => parseInt(value) >= 10
  },
  development: {
    JWT_SECRET: (value) => value && value.length >= 16,
    JWT_REFRESH_SECRET: (value) => value && value.length >= 16
  },
  test: {
    JWT_SECRET: (value) => value && value.includes('test'),
    JWT_REFRESH_SECRET: (value) => value && value.includes('test'),
    DATABASE_NAME: (value) => value && value.includes('test')
  }
};

class ConfigValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.environment = process.env.NODE_ENV || 'development';
  }

  /**
   * Load environment file if it exists
   */
  loadEnvFile() {
    const envFiles = [
      `.env.${this.environment}`,
      '.env.local',
      '.env'
    ];

    for (const envFile of envFiles) {
      const envPath = path.join(__dirname, '..', envFile);
      if (fs.existsSync(envPath)) {
        console.log(`Loading environment file: ${envFile}`);
        require('dotenv').config({ path: envPath });
        break;
      }
    }
  }

  /**
   * Validate that all required variables are present
   */
  validateRequiredVariables() {
    console.log('\n🔍 Validating required environment variables...');
    
    for (const [category, variables] of Object.entries(REQUIRED_CONFIG)) {
      console.log(`\n📋 Checking ${category} configuration:`);
      
      for (const variable of variables) {
        const value = process.env[variable];
        
        if (!value) {
          this.errors.push(`❌ Missing required variable: ${variable}`);
          console.log(`  ❌ ${variable}: MISSING`);
        } else {
          console.log(`  ✅ ${variable}: SET`);
        }
      }
    }
  }

  /**
   * Validate environment-specific rules
   */
  validateEnvironmentRules() {
    console.log(`\n🎯 Validating ${this.environment} environment rules...`);
    
    const rules = VALIDATION_RULES[this.environment];
    if (!rules) {
      this.warnings.push(`⚠️  No specific validation rules for environment: ${this.environment}`);
      return;
    }

    for (const [variable, validator] of Object.entries(rules)) {
      const value = process.env[variable];
      
      if (value && !validator(value)) {
        this.errors.push(`❌ Invalid value for ${variable} in ${this.environment} environment`);
        console.log(`  ❌ ${variable}: INVALID VALUE`);
      } else if (value) {
        console.log(`  ✅ ${variable}: VALID`);
      }
    }
  }

  /**
   * Validate service URLs are reachable (basic format check)
   */
  validateServiceUrls() {
    console.log('\n🌐 Validating service URLs...');
    
    const serviceUrls = [
      'USER_SERVICE_URL',
      'SECURITY_SERVICE_URL',
      'NOTIFICATION_SERVICE_URL'
    ];

    for (const urlVar of serviceUrls) {
      const url = process.env[urlVar];
      
      if (url) {
        try {
          new URL(url);
          console.log(`  ✅ ${urlVar}: Valid URL format`);
        } catch (error) {
          this.errors.push(`❌ Invalid URL format for ${urlVar}: ${url}`);
          console.log(`  ❌ ${urlVar}: INVALID URL FORMAT`);
        }
      }
    }
  }

  /**
   * Validate database connection string
   */
  validateDatabaseUrl() {
    console.log('\n🗄️  Validating database configuration...');
    
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      if (dbUrl.startsWith('postgresql://')) {
        console.log('  ✅ DATABASE_URL: Valid PostgreSQL format');
      } else {
        this.errors.push('❌ DATABASE_URL must be a valid PostgreSQL connection string');
        console.log('  ❌ DATABASE_URL: INVALID FORMAT');
      }
    }
  }

  /**
   * Validate Redis configuration
   */
  validateRedisConfig() {
    console.log('\n🔴 Validating Redis configuration...');
    
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      if (redisUrl.startsWith('redis://')) {
        console.log('  ✅ REDIS_URL: Valid Redis format');
      } else {
        this.errors.push('❌ REDIS_URL must be a valid Redis connection string');
        console.log('  ❌ REDIS_URL: INVALID FORMAT');
      }
    }

    const redisDb = process.env.REDIS_DB;
    if (redisDb) {
      const dbNum = parseInt(redisDb);
      if (dbNum >= 0 && dbNum <= 15) {
        console.log('  ✅ REDIS_DB: Valid database number');
      } else {
        this.errors.push('❌ REDIS_DB must be between 0 and 15');
        console.log('  ❌ REDIS_DB: INVALID RANGE');
      }
    }
  }

  /**
   * Check for security issues
   */
  validateSecurity() {
    console.log('\n🔒 Validating security configuration...');
    
    // Check for default/weak secrets
    const secrets = ['JWT_SECRET', 'JWT_REFRESH_SECRET'];
    for (const secret of secrets) {
      const value = process.env[secret];
      if (value) {
        if (value.includes('change-this') || value.includes('default') || value.length < 16) {
          this.errors.push(`❌ ${secret} appears to be a default or weak value`);
          console.log(`  ❌ ${secret}: WEAK/DEFAULT VALUE`);
        } else {
          console.log(`  ✅ ${secret}: Appears secure`);
        }
      }
    }

    // Check CORS configuration
    const corsOrigin = process.env.CORS_ORIGIN;
    if (corsOrigin && this.environment === 'production') {
      if (corsOrigin.includes('localhost') || corsOrigin === '*') {
        this.warnings.push('⚠️  CORS_ORIGIN contains localhost or wildcard in production');
        console.log('  ⚠️  CORS_ORIGIN: Contains localhost/wildcard in production');
      } else {
        console.log('  ✅ CORS_ORIGIN: Production-safe');
      }
    }
  }

  /**
   * Generate configuration summary
   */
  generateSummary() {
    console.log('\n📊 Configuration Summary:');
    console.log(`Environment: ${this.environment}`);
    console.log(`Port: ${process.env.PORT || 'NOT SET'}`);
    console.log(`Database: ${process.env.DATABASE_HOST || 'NOT SET'}:${process.env.DATABASE_PORT || 'NOT SET'}`);
    console.log(`Redis: ${process.env.REDIS_HOST || 'NOT SET'}:${process.env.REDIS_PORT || 'NOT SET'}`);
    console.log(`JWT Expiration: ${process.env.JWT_EXPIRES_IN || 'NOT SET'}`);
    console.log(`Max Sessions: ${process.env.MAX_SESSIONS_PER_USER || 'NOT SET'}`);
  }

  /**
   * Run all validations
   */
  validate() {
    console.log('🚀 Starting Auth Service Configuration Validation');
    console.log(`Environment: ${this.environment}`);
    
    this.loadEnvFile();
    this.validateRequiredVariables();
    this.validateEnvironmentRules();
    this.validateServiceUrls();
    this.validateDatabaseUrl();
    this.validateRedisConfig();
    this.validateSecurity();
    this.generateSummary();

    // Print results
    console.log('\n' + '='.repeat(50));
    console.log('📋 VALIDATION RESULTS');
    console.log('='.repeat(50));

    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('✅ All validations passed! Configuration is valid.');
      return true;
    }

    if (this.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      this.errors.forEach(error => console.log(`  ${error}`));
    }

    if (this.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      this.warnings.forEach(warning => console.log(`  ${warning}`));
    }

    console.log(`\nSummary: ${this.errors.length} errors, ${this.warnings.length} warnings`);
    
    return this.errors.length === 0;
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new ConfigValidator();
  const isValid = validator.validate();
  
  process.exit(isValid ? 0 : 1);
}

module.exports = ConfigValidator;