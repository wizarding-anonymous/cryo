#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Скрипт для аудита безопасности конфигурации User Service
 * 
 * Использование:
 * node scripts/security-audit.js [--env-file .env] [--fix-issues]
 * 
 * Примеры:
 * node scripts/security-audit.js
 * node scripts/security-audit.js --env-file .env.production
 * node scripts/security-audit.js --fix-issues
 */

class SecurityAuditor {
  constructor() {
    this.issues = [];
    this.warnings = [];
    this.recommendations = [];
  }

  addIssue(severity, category, message, fix = null) {
    this.issues.push({ severity, category, message, fix });
  }

  addWarning(category, message) {
    this.warnings.push({ category, message });
  }

  addRecommendation(category, message) {
    this.recommendations.push({ category, message });
  }

  loadEnvFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const env = {};
      
      content.split('\n').forEach(line => {
        line = line.trim();
        if (line && !line.startsWith('#')) {
          const [key, ...valueParts] = line.split('=');
          if (key && valueParts.length > 0) {
            env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
          }
        }
      });
      
      return env;
    } catch (error) {
      this.addIssue('HIGH', 'CONFIG', `Cannot read environment file: ${filePath}`);
      return {};
    }
  }

  auditApiKeys(env) {
    const apiKeys = env.INTERNAL_API_KEYS;
    
    if (!apiKeys) {
      this.addIssue('HIGH', 'API_KEYS', 'INTERNAL_API_KEYS not configured');
      return;
    }

    const keys = apiKeys.split(',').map(k => k.trim()).filter(k => k);
    
    if (keys.length === 0) {
      this.addIssue('HIGH', 'API_KEYS', 'No API keys configured');
      return;
    }

    console.log(`🔍 Auditing ${keys.length} API keys...`);

    keys.forEach((key, index) => {
      this.auditSingleApiKey(key, index + 1);
    });

    // Проверка на дублирование ключей
    const uniqueKeys = new Set(keys);
    if (uniqueKeys.size !== keys.length) {
      this.addIssue('MEDIUM', 'API_KEYS', 'Duplicate API keys found');
    }
  }

  auditSingleApiKey(key, index) {
    const keyPrefix = `API Key #${index}`;

    // Проверка длины
    if (key.length < 16) {
      this.addIssue('HIGH', 'API_KEYS', `${keyPrefix}: Too short (${key.length} chars, minimum 16)`);
    } else if (key.length < 32) {
      this.addWarning('API_KEYS', `${keyPrefix}: Short key (${key.length} chars, recommended 32+)`);
    }

    // Проверка на слабые паттерны
    const weakPatterns = ['test', 'dev', 'demo', '123', 'password', 'secret', 'key', 'admin'];
    const lowerKey = key.toLowerCase();
    
    weakPatterns.forEach(pattern => {
      if (lowerKey.includes(pattern)) {
        this.addIssue('MEDIUM', 'API_KEYS', `${keyPrefix}: Contains weak pattern "${pattern}"`);
      }
    });

    // Проверка энтропии
    const entropy = this.calculateEntropy(key);
    if (entropy < 3.0) {
      this.addIssue('MEDIUM', 'API_KEYS', `${keyPrefix}: Low entropy (${entropy.toFixed(2)}, recommended >4.0)`);
    }

    // Проверка на простые последовательности
    if (this.hasSimpleSequences(key)) {
      this.addIssue('MEDIUM', 'API_KEYS', `${keyPrefix}: Contains simple sequences`);
    }
  }

  calculateEntropy(str) {
    const freq = {};
    for (let char of str) {
      freq[char] = (freq[char] || 0) + 1;
    }

    let entropy = 0;
    const len = str.length;
    
    for (let char in freq) {
      const p = freq[char] / len;
      entropy -= p * Math.log2(p);
    }

    return entropy;
  }

  hasSimpleSequences(str) {
    // Проверка на повторяющиеся символы
    if (/(.)\1{3,}/.test(str)) return true;
    
    // Проверка на простые последовательности
    const sequences = ['1234', 'abcd', '0123', 'abc', '123'];
    return sequences.some(seq => str.toLowerCase().includes(seq));
  }

  auditIpWhitelist(env) {
    const allowedIPs = env.INTERNAL_ALLOWED_IPS;
    
    if (!allowedIPs) {
      this.addIssue('HIGH', 'IP_WHITELIST', 'INTERNAL_ALLOWED_IPS not configured');
      return;
    }

    const ips = allowedIPs.split(',').map(ip => ip.trim()).filter(ip => ip);
    
    if (ips.length === 0) {
      this.addIssue('HIGH', 'IP_WHITELIST', 'No IP addresses configured');
      return;
    }

    console.log(`🔍 Auditing ${ips.length} IP addresses/ranges...`);

    ips.forEach((ip, index) => {
      this.auditSingleIP(ip, index + 1);
    });

    // Проверка на слишком широкие диапазоны
    const broadRanges = ips.filter(ip => {
      if (ip.includes('/')) {
        const [, prefix] = ip.split('/');
        const prefixNum = parseInt(prefix);
        return prefixNum < 16; // Очень широкий диапазон
      }
      return false;
    });

    if (broadRanges.length > 0) {
      this.addWarning('IP_WHITELIST', `Very broad IP ranges detected: ${broadRanges.join(', ')}`);
    }
  }

  auditSingleIP(ip, index) {
    const ipPrefix = `IP #${index}`;

    // Проверка формата IP
    if (ip.includes('/')) {
      // CIDR нотация
      const [network, prefix] = ip.split('/');
      
      if (!this.isValidIPv4(network)) {
        this.addIssue('MEDIUM', 'IP_WHITELIST', `${ipPrefix}: Invalid network address in CIDR: ${network}`);
      }
      
      const prefixNum = parseInt(prefix);
      if (isNaN(prefixNum) || prefixNum < 0 || prefixNum > 32) {
        this.addIssue('MEDIUM', 'IP_WHITELIST', `${ipPrefix}: Invalid CIDR prefix: ${prefix}`);
      }
    } else {
      // Отдельный IP
      if (!this.isValidIPv4(ip) && !this.isValidIPv6(ip)) {
        this.addIssue('MEDIUM', 'IP_WHITELIST', `${ipPrefix}: Invalid IP address format: ${ip}`);
      }
    }

    // Проверка на публичные IP в production
    if (process.env.NODE_ENV === 'production' && this.isPublicIP(ip)) {
      this.addWarning('IP_WHITELIST', `${ipPrefix}: Public IP address in production: ${ip}`);
    }
  }

  isValidIPv4(ip) {
    const parts = ip.split('.');
    if (parts.length !== 4) return false;
    
    return parts.every(part => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255 && part === num.toString();
    });
  }

  isValidIPv6(ip) {
    // Упрощенная проверка IPv6
    return /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$/.test(ip);
  }

  isPublicIP(ip) {
    if (ip.includes('/')) {
      ip = ip.split('/')[0];
    }

    // Проверка на приватные диапазоны
    const privateRanges = [
      /^127\./, // 127.0.0.0/8
      /^10\./, // 10.0.0.0/8
      /^192\.168\./, // 192.168.0.0/16
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
      /^::1$/, // IPv6 localhost
    ];

    return !privateRanges.some(range => range.test(ip));
  }

  auditInternalSecret(env) {
    const secret = env.INTERNAL_SERVICE_SECRET;
    
    if (!secret) {
      this.addIssue('HIGH', 'INTERNAL_SECRET', 'INTERNAL_SERVICE_SECRET not configured');
      return;
    }

    console.log('🔍 Auditing internal service secret...');

    if (secret.length < 16) {
      this.addIssue('HIGH', 'INTERNAL_SECRET', `Secret too short (${secret.length} chars, minimum 16)`);
    }

    // Проверка на слабые паттерны
    const weakPatterns = ['test', 'dev', 'demo', 'secret', 'password'];
    const lowerSecret = secret.toLowerCase();
    
    weakPatterns.forEach(pattern => {
      if (lowerSecret.includes(pattern)) {
        this.addIssue('MEDIUM', 'INTERNAL_SECRET', `Secret contains weak pattern "${pattern}"`);
      }
    });
  }

  auditEncryption(env) {
    const encryptionKey = env.ENCRYPTION_KEY;
    
    if (!encryptionKey) {
      this.addIssue('HIGH', 'ENCRYPTION', 'ENCRYPTION_KEY not configured');
      return;
    }

    console.log('🔍 Auditing encryption configuration...');

    if (encryptionKey.length < 32) {
      this.addIssue('HIGH', 'ENCRYPTION', `Encryption key too short (${encryptionKey.length} chars, minimum 32)`);
    }

    // Проверка на слабые ключи
    if (encryptionKey.includes('your-') || encryptionKey.includes('example')) {
      this.addIssue('HIGH', 'ENCRYPTION', 'Using example/placeholder encryption key');
    }
  }

  auditEnvironmentSettings(env) {
    console.log('🔍 Auditing environment settings...');

    const nodeEnv = env.NODE_ENV || 'development';
    
    // Проверки для production
    if (nodeEnv === 'production') {
      if (env.LOG_LEVEL === 'debug') {
        this.addWarning('ENVIRONMENT', 'Debug logging enabled in production');
      }

      if (env.CORS_ORIGIN === '*') {
        this.addWarning('ENVIRONMENT', 'CORS allows all origins in production');
      }

      if (env.HELMET_ENABLED !== 'true') {
        this.addIssue('MEDIUM', 'ENVIRONMENT', 'Helmet security headers disabled in production');
      }
    }

    // Проверка rate limiting
    if (env.RATE_LIMIT_ENABLED !== 'true') {
      this.addWarning('ENVIRONMENT', 'Rate limiting disabled');
    }
  }

  generateSecurityReport() {
    console.log('\n📊 SECURITY AUDIT REPORT');
    console.log('========================\n');

    // Статистика
    const highIssues = this.issues.filter(i => i.severity === 'HIGH').length;
    const mediumIssues = this.issues.filter(i => i.severity === 'MEDIUM').length;
    const lowIssues = this.issues.filter(i => i.severity === 'LOW').length;

    console.log(`📈 Summary:`);
    console.log(`   🔴 High severity issues: ${highIssues}`);
    console.log(`   🟡 Medium severity issues: ${mediumIssues}`);
    console.log(`   🟢 Low severity issues: ${lowIssues}`);
    console.log(`   ⚠️  Warnings: ${this.warnings.length}`);
    console.log(`   💡 Recommendations: ${this.recommendations.length}\n`);

    // Критические проблемы
    if (highIssues > 0) {
      console.log('🔴 HIGH SEVERITY ISSUES (Must Fix):');
      console.log('===================================');
      this.issues
        .filter(i => i.severity === 'HIGH')
        .forEach(issue => {
          console.log(`   [${issue.category}] ${issue.message}`);
          if (issue.fix) {
            console.log(`   💡 Fix: ${issue.fix}`);
          }
        });
      console.log();
    }

    // Средние проблемы
    if (mediumIssues > 0) {
      console.log('🟡 MEDIUM SEVERITY ISSUES (Should Fix):');
      console.log('======================================');
      this.issues
        .filter(i => i.severity === 'MEDIUM')
        .forEach(issue => {
          console.log(`   [${issue.category}] ${issue.message}`);
          if (issue.fix) {
            console.log(`   💡 Fix: ${issue.fix}`);
          }
        });
      console.log();
    }

    // Предупреждения
    if (this.warnings.length > 0) {
      console.log('⚠️  WARNINGS (Consider Fixing):');
      console.log('==============================');
      this.warnings.forEach(warning => {
        console.log(`   [${warning.category}] ${warning.message}`);
      });
      console.log();
    }

    // Рекомендации
    if (this.recommendations.length > 0) {
      console.log('💡 RECOMMENDATIONS:');
      console.log('==================');
      this.recommendations.forEach(rec => {
        console.log(`   [${rec.category}] ${rec.message}`);
      });
      console.log();
    }

    // Общая оценка безопасности
    let securityScore = 100;
    securityScore -= highIssues * 20;
    securityScore -= mediumIssues * 10;
    securityScore -= lowIssues * 5;
    securityScore -= this.warnings.length * 2;
    securityScore = Math.max(0, securityScore);

    console.log(`🏆 SECURITY SCORE: ${securityScore}/100`);
    
    if (securityScore >= 90) {
      console.log('   ✅ Excellent security configuration!');
    } else if (securityScore >= 70) {
      console.log('   🟡 Good security, but some improvements needed');
    } else if (securityScore >= 50) {
      console.log('   🟠 Moderate security, several issues to address');
    } else {
      console.log('   🔴 Poor security, immediate attention required!');
    }

    return securityScore;
  }

  audit(envFile = '.env') {
    console.log('🔒 User Service Security Audit');
    console.log('==============================\n');
    
    const envPath = path.resolve(envFile);
    console.log(`📁 Auditing configuration: ${envPath}\n`);

    const env = this.loadEnvFile(envPath);
    
    if (Object.keys(env).length === 0) {
      console.log('❌ No configuration found to audit');
      return 0;
    }

    // Выполняем аудит различных компонентов
    this.auditApiKeys(env);
    this.auditIpWhitelist(env);
    this.auditInternalSecret(env);
    this.auditEncryption(env);
    this.auditEnvironmentSettings(env);

    // Генерируем отчет
    return this.generateSecurityReport();
  }
}

function main() {
  const args = process.argv.slice(2);
  let envFile = '.env';
  let fixIssues = false;

  // Парсинг аргументов
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--env-file' && i + 1 < args.length) {
      envFile = args[i + 1];
      i++;
    } else if (args[i] === '--fix-issues') {
      fixIssues = true;
    }
  }

  const auditor = new SecurityAuditor();
  const score = auditor.audit(envFile);

  if (fixIssues) {
    console.log('\n🔧 Auto-fix is not implemented yet');
    console.log('   Please address the issues manually');
  }

  // Возвращаем код выхода на основе оценки безопасности
  if (score < 50) {
    process.exit(2); // Критические проблемы
  } else if (score < 70) {
    process.exit(1); // Есть проблемы
  } else {
    process.exit(0); // Все хорошо
  }
}

// Запускаем скрипт только если он вызван напрямую
if (require.main === module) {
  main();
}

module.exports = SecurityAuditor;