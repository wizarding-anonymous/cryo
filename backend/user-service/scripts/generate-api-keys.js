#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Скрипт для генерации безопасных API ключей для внутренних сервисов
 * 
 * Использование:
 * node scripts/generate-api-keys.js [environment] [--output-file]
 * 
 * Примеры:
 * node scripts/generate-api-keys.js development
 * node scripts/generate-api-keys.js production --output-file
 */

const SERVICES = [
  'auth-service',
  'game-catalog-service', 
  'payment-service',
  'library-service',
  'security-service',
  'notification-service'
];

const ENVIRONMENTS = ['development', 'staging', 'production'];

function generateSecureKey(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

function generateInternalSecret(environment, length = 32) {
  const base = `user-service-internal-secret-${environment}`;
  const randomSuffix = crypto.randomBytes(8).toString('hex');
  return `${base}-${randomSuffix}`;
}

function validateKeyStrength(key) {
  const issues = [];
  
  if (key.length < 16) {
    issues.push('Key is too short (minimum 16 characters)');
  }
  
  const weakPatterns = ['test', 'dev', 'demo', '123', 'password', 'secret', 'key'];
  const lowerKey = key.toLowerCase();
  
  for (const pattern of weakPatterns) {
    if (lowerKey.includes(pattern)) {
      issues.push(`Key contains weak pattern: ${pattern}`);
    }
  }
  
  if (!/[a-f0-9]+/.test(key)) {
    issues.push('Key should contain hexadecimal characters');
  }
  
  return issues;
}

function generateKeysForEnvironment(environment) {
  console.log(`\n🔐 Generating API keys for ${environment.toUpperCase()} environment\n`);
  
  const keys = {};
  const keyList = [];
  
  // Генерируем ключи для каждого сервиса
  for (const service of SERVICES) {
    const keyLength = environment === 'production' ? 64 : 32;
    const key = generateSecureKey(keyLength);
    const keyName = `${service}-${environment}-key`;
    
    keys[keyName] = key;
    keyList.push(key);
    
    // Валидируем ключ
    const issues = validateKeyStrength(key);
    if (issues.length > 0) {
      console.warn(`⚠️  Warning for ${keyName}:`);
      issues.forEach(issue => console.warn(`   - ${issue}`));
    } else {
      console.log(`✅ ${keyName}: ${key.substring(0, 8)}...${key.substring(-8)}`);
    }
  }
  
  // Генерируем внутренний секрет
  const internalSecret = generateInternalSecret(environment);
  keys.internalSecret = internalSecret;
  
  console.log(`✅ internal-secret: ${internalSecret.substring(0, 20)}...`);
  
  // Формируем переменные окружения
  const envVars = {
    INTERNAL_API_KEYS: keyList.join(','),
    INTERNAL_SERVICE_SECRET: internalSecret
  };
  
  return { keys, envVars };
}

function generateDockerComposeOverride(environment, envVars) {
  const override = `# Docker Compose override for ${environment} environment
# Generated on ${new Date().toISOString()}

version: '3.8'

services:
  user-service:
    environment:
      - NODE_ENV=${environment}
      - INTERNAL_API_KEYS=${envVars.INTERNAL_API_KEYS}
      - INTERNAL_SERVICE_SECRET=${envVars.INTERNAL_SERVICE_SECRET}
      # Add other environment-specific variables here
`;

  return override;
}

function generateKubernetesSecret(environment, envVars) {
  const secretData = {
    'internal-api-keys': Buffer.from(envVars.INTERNAL_API_KEYS).toString('base64'),
    'internal-service-secret': Buffer.from(envVars.INTERNAL_SERVICE_SECRET).toString('base64')
  };

  const secret = `# Kubernetes Secret for ${environment} environment
# Generated on ${new Date().toISOString()}

apiVersion: v1
kind: Secret
metadata:
  name: user-service-internal-api-keys-${environment}
  namespace: default
type: Opaque
data:
  internal-api-keys: ${secretData['internal-api-keys']}
  internal-service-secret: ${secretData['internal-service-secret']}
`;

  return secret;
}

function main() {
  const args = process.argv.slice(2);
  const environment = args[0] || 'development';
  const outputFile = args.includes('--output-file');
  
  if (!ENVIRONMENTS.includes(environment)) {
    console.error(`❌ Invalid environment: ${environment}`);
    console.error(`   Valid environments: ${ENVIRONMENTS.join(', ')}`);
    process.exit(1);
  }
  
  console.log('🚀 User Service API Key Generator');
  console.log('==================================');
  
  const { keys, envVars } = generateKeysForEnvironment(environment);
  
  console.log('\n📋 Environment Variables:');
  console.log('========================');
  console.log(`INTERNAL_API_KEYS="${envVars.INTERNAL_API_KEYS}"`);
  console.log(`INTERNAL_SERVICE_SECRET="${envVars.INTERNAL_SERVICE_SECRET}"`);
  
  if (outputFile) {
    const outputDir = path.join(__dirname, '..', 'generated-keys');
    
    // Создаем директорию если не существует
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Сохраняем ключи в JSON файл
    const keysFile = path.join(outputDir, `api-keys-${environment}.json`);
    fs.writeFileSync(keysFile, JSON.stringify(keys, null, 2));
    console.log(`\n💾 Keys saved to: ${keysFile}`);
    
    // Сохраняем переменные окружения
    const envFile = path.join(outputDir, `env-vars-${environment}.txt`);
    const envContent = Object.entries(envVars)
      .map(([key, value]) => `${key}="${value}"`)
      .join('\n');
    fs.writeFileSync(envFile, envContent);
    console.log(`💾 Environment variables saved to: ${envFile}`);
    
    // Генерируем Docker Compose override
    const dockerOverride = generateDockerComposeOverride(environment, envVars);
    const dockerFile = path.join(outputDir, `docker-compose.override.${environment}.yml`);
    fs.writeFileSync(dockerFile, dockerOverride);
    console.log(`💾 Docker Compose override saved to: ${dockerFile}`);
    
    // Генерируем Kubernetes Secret
    const k8sSecret = generateKubernetesSecret(environment, envVars);
    const k8sFile = path.join(outputDir, `k8s-secret-${environment}.yml`);
    fs.writeFileSync(k8sFile, k8sSecret);
    console.log(`💾 Kubernetes Secret saved to: ${k8sFile}`);
  }
  
  console.log('\n🔒 Security Recommendations:');
  console.log('============================');
  console.log('1. Store these keys securely (use a password manager)');
  console.log('2. Never commit production keys to version control');
  console.log('3. Rotate keys regularly (every 90 days recommended)');
  console.log('4. Use different keys for each environment');
  console.log('5. Monitor access logs for suspicious activity');
  
  if (environment === 'production') {
    console.log('\n⚠️  PRODUCTION ENVIRONMENT WARNINGS:');
    console.log('===================================');
    console.log('- These keys provide access to sensitive user data');
    console.log('- Ensure all communication uses HTTPS/TLS');
    console.log('- Implement proper key rotation procedures');
    console.log('- Set up monitoring and alerting for key usage');
    console.log('- Consider using a secrets management system (HashiCorp Vault, AWS Secrets Manager)');
  }
  
  console.log('\n✅ Key generation completed successfully!');
}

// Запускаем скрипт только если он вызван напрямую
if (require.main === module) {
  main();
}

module.exports = {
  generateSecureKey,
  generateInternalSecret,
  validateKeyStrength,
  generateKeysForEnvironment
};