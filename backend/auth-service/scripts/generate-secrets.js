#!/usr/bin/env node

/**
 * Secret Generation Script for Auth Service
 * 
 * This script generates cryptographically secure secrets for JWT tokens
 * and other security-sensitive configuration values.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class SecretGenerator {
  constructor() {
    this.secrets = {};
  }

  /**
   * Generate a cryptographically secure random string
   */
  generateSecret(length = 64, encoding = 'hex') {
    return crypto.randomBytes(length).toString(encoding);
  }

  /**
   * Generate a secure password with specific requirements
   */
  generatePassword(length = 32) {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    const allChars = uppercase + lowercase + numbers + symbols;

    let password = '';
    
    // Ensure at least one character from each category
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];

    // Fill the rest randomly
    for (let i = 4; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  /**
   * Generate all required secrets for Auth Service
   */
  generateAllSecrets() {
    console.log('🔐 Generating secure secrets for Auth Service...\n');

    // JWT Secrets
    this.secrets.JWT_SECRET = this.generateSecret(64);
    this.secrets.JWT_REFRESH_SECRET = this.generateSecret(64);
    console.log('✅ Generated JWT secrets');

    // Database passwords
    this.secrets.DATABASE_PASSWORD = this.generatePassword(24);
    console.log('✅ Generated database password');

    // Redis password
    this.secrets.REDIS_PASSWORD = this.generatePassword(20);
    console.log('✅ Generated Redis password');

    // Session secret
    this.secrets.SESSION_SECRET = this.generateSecret(48);
    console.log('✅ Generated session secret');

    // API keys for external services
    this.secrets.WEBHOOK_SECRET = this.generateSecret(32);
    this.secrets.ENCRYPTION_KEY = this.generateSecret(32);
    console.log('✅ Generated API and encryption keys');

    return this.secrets;
  }

  /**
   * Generate environment-specific configuration
   */
  generateEnvironmentConfig(environment = 'production') {
    const secrets = this.generateAllSecrets();
    
    const config = {
      production: {
        JWT_SECRET: secrets.JWT_SECRET,
        JWT_REFRESH_SECRET: secrets.JWT_REFRESH_SECRET,
        JWT_EXPIRES_IN: '15m',
        JWT_REFRESH_EXPIRES_IN: '7d',
        DATABASE_PASSWORD: secrets.DATABASE_PASSWORD,
        REDIS_PASSWORD: secrets.REDIS_PASSWORD,
        SESSION_SECRET: secrets.SESSION_SECRET,
        BCRYPT_ROUNDS: '12',
        LOG_LEVEL: 'warn'
      },
      staging: {
        JWT_SECRET: secrets.JWT_SECRET,
        JWT_REFRESH_SECRET: secrets.JWT_REFRESH_SECRET,
        JWT_EXPIRES_IN: '30m',
        JWT_REFRESH_EXPIRES_IN: '7d',
        DATABASE_PASSWORD: secrets.DATABASE_PASSWORD,
        REDIS_PASSWORD: secrets.REDIS_PASSWORD,
        SESSION_SECRET: secrets.SESSION_SECRET,
        BCRYPT_ROUNDS: '10',
        LOG_LEVEL: 'info'
      },
      development: {
        JWT_SECRET: 'dev-jwt-secret-' + this.generateSecret(16),
        JWT_REFRESH_SECRET: 'dev-refresh-secret-' + this.generateSecret(16),
        JWT_EXPIRES_IN: '2h',
        JWT_REFRESH_EXPIRES_IN: '7d',
        DATABASE_PASSWORD: 'dev_password_123',
        REDIS_PASSWORD: 'dev_redis_123',
        SESSION_SECRET: 'dev-session-' + this.generateSecret(16),
        BCRYPT_ROUNDS: '8',
        LOG_LEVEL: 'debug'
      }
    };

    return config[environment] || config.production;
  }

  /**
   * Save secrets to a secure file
   */
  saveSecretsToFile(environment = 'production', outputPath = null) {
    const config = this.generateEnvironmentConfig(environment);
    
    if (!outputPath) {
      outputPath = path.join(__dirname, '..', `.secrets.${environment}.env`);
    }

    let content = `# Generated secrets for ${environment} environment\n`;
    content += `# Generated on: ${new Date().toISOString()}\n`;
    content += `# WARNING: Keep this file secure and never commit to version control!\n\n`;

    for (const [key, value] of Object.entries(config)) {
      content += `${key}=${value}\n`;
    }

    fs.writeFileSync(outputPath, content, { mode: 0o600 }); // Readable only by owner
    console.log(`\n💾 Secrets saved to: ${outputPath}`);
    console.log('⚠️  WARNING: Keep this file secure and never commit to version control!');
    
    return outputPath;
  }

  /**
   * Generate Docker Compose environment variables
   */
  generateDockerComposeEnv() {
    const secrets = this.generateAllSecrets();
    
    const dockerEnv = `# Docker Compose Environment Variables
# Generated on: ${new Date().toISOString()}
# Copy these to your .env file for Docker Compose

# Auth Service Secrets
AUTH_JWT_SECRET=${secrets.JWT_SECRET}
AUTH_JWT_REFRESH_SECRET=${secrets.JWT_REFRESH_SECRET}

# Database Configuration
POSTGRES_AUTH_PASSWORD=${secrets.DATABASE_PASSWORD}

# Redis Configuration
REDIS_PASSWORD=${secrets.REDIS_PASSWORD}

# Additional Secrets
SESSION_SECRET=${secrets.SESSION_SECRET}
WEBHOOK_SECRET=${secrets.WEBHOOK_SECRET}
ENCRYPTION_KEY=${secrets.ENCRYPTION_KEY}
`;

    const outputPath = path.join(__dirname, '..', '..', '.env.secrets');
    fs.writeFileSync(outputPath, dockerEnv, { mode: 0o600 });
    
    console.log(`\n🐳 Docker Compose secrets saved to: ${outputPath}`);
    return outputPath;
  }

  /**
   * Generate Kubernetes secrets YAML
   */
  generateKubernetesSecrets() {
    const secrets = this.generateAllSecrets();
    
    const k8sSecrets = {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: {
        name: 'auth-service-secrets',
        namespace: 'default'
      },
      type: 'Opaque',
      data: {}
    };

    // Base64 encode all secrets for Kubernetes
    for (const [key, value] of Object.entries(secrets)) {
      k8sSecrets.data[key] = Buffer.from(value).toString('base64');
    }

    const yamlContent = `# Kubernetes Secrets for Auth Service
# Generated on: ${new Date().toISOString()}
# Apply with: kubectl apply -f auth-service-secrets.yaml

apiVersion: v1
kind: Secret
metadata:
  name: auth-service-secrets
  namespace: default
type: Opaque
data:
${Object.entries(k8sSecrets.data).map(([key, value]) => `  ${key}: ${value}`).join('\n')}
`;

    const outputPath = path.join(__dirname, '..', 'k8s', 'auth-service-secrets.yaml');
    
    // Create k8s directory if it doesn't exist
    const k8sDir = path.dirname(outputPath);
    if (!fs.existsSync(k8sDir)) {
      fs.mkdirSync(k8sDir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, yamlContent, { mode: 0o600 });
    
    console.log(`\n☸️  Kubernetes secrets saved to: ${outputPath}`);
    return outputPath;
  }

  /**
   * Display security recommendations
   */
  displaySecurityRecommendations() {
    console.log('\n' + '='.repeat(60));
    console.log('🔒 SECURITY RECOMMENDATIONS');
    console.log('='.repeat(60));
    
    console.log('\n📋 Secret Management:');
    console.log('  • Store secrets in environment variables, not in code');
    console.log('  • Use different secrets for each environment');
    console.log('  • Rotate secrets regularly (every 90 days recommended)');
    console.log('  • Never commit secrets to version control');
    console.log('  • Use a secrets management system in production');
    
    console.log('\n🔐 JWT Security:');
    console.log('  • Use strong, random secrets (minimum 256 bits)');
    console.log('  • Keep access token expiration short (15-30 minutes)');
    console.log('  • Implement proper token rotation');
    console.log('  • Use different secrets for access and refresh tokens');
    
    console.log('\n🗄️  Database Security:');
    console.log('  • Use strong, unique passwords for each environment');
    console.log('  • Enable SSL/TLS connections in production');
    console.log('  • Implement connection pooling and timeouts');
    console.log('  • Regular security updates and patches');
    
    console.log('\n🔴 Redis Security:');
    console.log('  • Always use password authentication');
    console.log('  • Configure appropriate timeout values');
    console.log('  • Use SSL/TLS in production');
    console.log('  • Implement proper access controls');
    
    console.log('\n⚠️  Important Notes:');
    console.log('  • Generated files are marked as read-only (600 permissions)');
    console.log('  • Add .secrets.*.env to your .gitignore file');
    console.log('  • Backup secrets securely before deployment');
    console.log('  • Test configuration in staging before production');
  }
}

// CLI interface
function main() {
  const args = process.argv.slice(2);
  const generator = new SecretGenerator();
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Auth Service Secret Generator

Usage:
  node generate-secrets.js [options]

Options:
  --env <environment>     Generate secrets for specific environment (production, staging, development)
  --docker               Generate Docker Compose environment file
  --kubernetes           Generate Kubernetes secrets YAML
  --all                  Generate all formats
  --help, -h             Show this help message

Examples:
  node generate-secrets.js --env production
  node generate-secrets.js --docker
  node generate-secrets.js --kubernetes
  node generate-secrets.js --all
`);
    return;
  }

  console.log('🔐 Auth Service Secret Generator\n');

  if (args.includes('--all')) {
    generator.saveSecretsToFile('production');
    generator.saveSecretsToFile('staging');
    generator.saveSecretsToFile('development');
    generator.generateDockerComposeEnv();
    generator.generateKubernetesSecrets();
  } else if (args.includes('--docker')) {
    generator.generateDockerComposeEnv();
  } else if (args.includes('--kubernetes')) {
    generator.generateKubernetesSecrets();
  } else {
    const envIndex = args.indexOf('--env');
    const environment = envIndex !== -1 && args[envIndex + 1] ? args[envIndex + 1] : 'production';
    generator.saveSecretsToFile(environment);
  }

  generator.displaySecurityRecommendations();
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = SecretGenerator;