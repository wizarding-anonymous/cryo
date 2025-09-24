import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';

/**
 * Enhanced secrets management service for production
 * Features:
 * - File-based secrets loading
 * - Environment variable fallback
 * - Secret validation and rotation
 * - Secure secret generation
 * - Runtime secret validation
 */

export interface SecretConfig {
  name: string;
  envVar?: string;
  required: boolean;
  minLength?: number;
  pattern?: RegExp;
  description?: string;
}

@Injectable()
export class SecretsManagerService implements OnModuleInit {
  private readonly logger = new Logger(SecretsManagerService.name);
  private readonly secretsPath: string;
  private readonly secrets = new Map<string, string>();
  private readonly isProduction: boolean;

  private readonly secretConfigs: SecretConfig[] = [
    {
      name: 'database-password',
      envVar: 'DATABASE_PASSWORD',
      required: true,
      minLength: 12,
      description: 'Database connection password',
    },
    {
      name: 'jwt-secret',
      envVar: 'JWT_SECRET',
      required: true,
      minLength: 32,
      description: 'JWT signing secret',
    },
    {
      name: 'redis-password',
      envVar: 'REDIS_PASSWORD',
      required: false,
      minLength: 8,
      description: 'Redis connection password',
    },
    {
      name: 'api-key',
      envVar: 'API_KEY_VALUE',
      required: false,
      minLength: 16,
      description: 'API key for service authentication',
    },
    {
      name: 'encryption-key',
      envVar: 'ENCRYPTION_KEY',
      required: false,
      minLength: 32,
      description: 'Data encryption key',
    },
  ];

  constructor(private readonly configService: ConfigService) {
    this.secretsPath = join(process.cwd(), 'secrets');
    this.isProduction = this.configService.get('NODE_ENV') === 'production';
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.initializeSecrets();
      this.logger.log('Secrets manager initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize secrets manager:', error);
      if (this.isProduction) {
        throw error;
      }
    }
  }

  /**
   * Get a secret value
   */
  getSecret(name: string): string | undefined {
    return this.secrets.get(name);
  }

  /**
   * Get a required secret value (throws if not found)
   */
  getRequiredSecret(name: string): string {
    const secret = this.secrets.get(name);
    if (!secret) {
      throw new Error(`Required secret '${name}' not found`);
    }
    return secret;
  }

  /**
   * Check if a secret exists
   */
  hasSecret(name: string): boolean {
    return this.secrets.has(name);
  }

  /**
   * Validate all secrets
   */
  validateSecrets(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const config of this.secretConfigs) {
      if (config.required && !this.hasSecret(config.name)) {
        errors.push(`Required secret '${config.name}' is missing`);
        continue;
      }

      const secret = this.getSecret(config.name);
      if (secret) {
        // Validate minimum length
        if (config.minLength && secret.length < config.minLength) {
          errors.push(
            `Secret '${config.name}' is too short (minimum ${config.minLength} characters)`,
          );
        }

        // Validate pattern
        if (config.pattern && !config.pattern.test(secret)) {
          errors.push(
            `Secret '${config.name}' does not match required pattern`,
          );
        }

        // Validate strength for passwords
        if (
          config.name.includes('password') &&
          !this.isStrongPassword(secret)
        ) {
          errors.push(`Secret '${config.name}' is not strong enough`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Generate a new secret
   */
  generateSecret(
    length: number = 32,
    includeSpecialChars: boolean = true,
  ): string {
    const charset =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    const chars = includeSpecialChars ? charset + specialChars : charset;

    let result = '';
    const bytes = randomBytes(length);

    for (let i = 0; i < length; i++) {
      result += chars[bytes[i] % chars.length];
    }

    return result;
  }

  /**
   * Create missing secrets with secure defaults
   */
  async createMissingSecrets(): Promise<void> {
    this.ensureSecretsDirectory();

    for (const config of this.secretConfigs) {
      if (!this.hasSecret(config.name)) {
        const secretValue = this.generateSecretForConfig(config);
        await this.saveSecretToFile(config.name, secretValue);
        this.secrets.set(config.name, secretValue);

        this.logger.log(`Generated new secret: ${config.name}`);
      }
    }
  }

  /**
   * Rotate a secret (generate new value)
   */
  async rotateSecret(name: string): Promise<void> {
    const config = this.secretConfigs.find((c) => c.name === name);
    if (!config) {
      throw new Error(`Unknown secret configuration: ${name}`);
    }

    const newSecret = this.generateSecretForConfig(config);
    await this.saveSecretToFile(name, newSecret);
    this.secrets.set(name, newSecret);

    this.logger.log(`Rotated secret: ${name}`);
  }

  /**
   * Get secrets status for monitoring
   */
  getSecretsStatus(): {
    total: number;
    loaded: number;
    missing: string[];
    weak: string[];
  } {
    const missing: string[] = [];
    const weak: string[] = [];

    for (const config of this.secretConfigs) {
      if (config.required && !this.hasSecret(config.name)) {
        missing.push(config.name);
      }

      const secret = this.getSecret(config.name);
      if (
        secret &&
        config.name.includes('password') &&
        !this.isStrongPassword(secret)
      ) {
        weak.push(config.name);
      }
    }

    return {
      total: this.secretConfigs.length,
      loaded: this.secrets.size,
      missing,
      weak,
    };
  }

  /**
   * Initialize secrets from files and environment
   */
  private async initializeSecrets(): Promise<void> {
    this.ensureSecretsDirectory();

    for (const config of this.secretConfigs) {
      try {
        const secret = this.loadSecret(config);
        if (secret) {
          this.secrets.set(config.name, secret);
        } else if (config.required) {
          if (this.isProduction) {
            throw new Error(`Required secret '${config.name}' not found`);
          } else {
            this.logger.warn(
              `Required secret '${config.name}' not found, generating default`,
            );
            const defaultSecret = this.generateSecretForConfig(config);
            await this.saveSecretToFile(config.name, defaultSecret);
            this.secrets.set(config.name, defaultSecret);
          }
        }
      } catch (error) {
        this.logger.error(`Failed to load secret '${config.name}':`, error);
        if (config.required && this.isProduction) {
          throw error;
        }
      }
    }

    // Validate all loaded secrets
    const validation = this.validateSecrets();
    if (!validation.valid) {
      const errorMessage = `Secret validation failed: ${validation.errors.join(', ')}`;
      if (this.isProduction) {
        throw new Error(errorMessage);
      } else {
        this.logger.warn(errorMessage);
      }
    }
  }

  /**
   * Load secret from file or environment variable
   */
  private loadSecret(config: SecretConfig): string | null {
    // Try environment variable first
    if (config.envVar && process.env[config.envVar]) {
      return process.env[config.envVar]!;
    }

    // Try loading from secrets file
    const secretPath = join(this.secretsPath, `${config.name}.txt`);
    if (existsSync(secretPath)) {
      try {
        return readFileSync(secretPath, 'utf8').trim();
      } catch (error) {
        this.logger.error(`Failed to read secret file ${secretPath}:`, error);
      }
    }

    // Try default environment variable naming
    const defaultEnvVar = config.name.toUpperCase().replace(/-/g, '_');
    if (process.env[defaultEnvVar]) {
      return process.env[defaultEnvVar];
    }

    return null;
  }

  /**
   * Save secret to file
   */
  private async saveSecretToFile(name: string, value: string): Promise<void> {
    const secretPath = join(this.secretsPath, `${name}.txt`);
    try {
      writeFileSync(secretPath, value, { mode: 0o600 }); // Read/write for owner only
    } catch (error) {
      this.logger.error(`Failed to save secret file ${secretPath}:`, error);
      throw error;
    }
  }

  /**
   * Ensure secrets directory exists
   */
  private ensureSecretsDirectory(): void {
    if (!existsSync(this.secretsPath)) {
      try {
        mkdirSync(this.secretsPath, { mode: 0o700 }); // Read/write/execute for owner only
      } catch (error) {
        this.logger.error(`Failed to create secrets directory:`, error);
        throw error;
      }
    }
  }

  /**
   * Generate secret for specific configuration
   */
  private generateSecretForConfig(config: SecretConfig): string {
    const length = Math.max(config.minLength || 32, 32);

    if (config.name.includes('jwt')) {
      // JWT secrets should be longer and more complex
      return this.generateSecret(64, true);
    } else if (config.name.includes('password')) {
      // Passwords should include special characters
      return this.generateSecret(length, true);
    } else if (config.name.includes('key')) {
      // Keys should be alphanumeric for compatibility
      return this.generateSecret(length, false);
    } else {
      // Default generation
      return this.generateSecret(length, true);
    }
  }

  /**
   * Check if password is strong enough
   */
  private isStrongPassword(password: string): boolean {
    if (password.length < 12) return false;

    const hasLowerCase = /[a-z]/.test(password);
    const hasUpperCase = /[A-Z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password);

    return hasLowerCase && hasUpperCase && hasNumbers && hasSpecialChars;
  }
}
