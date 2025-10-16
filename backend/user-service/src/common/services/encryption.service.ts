import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface EncryptedData {
  encrypted: string;
  iv: string;
  tag: string;
}

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor(private readonly configService: ConfigService) {
    const encryptionKey = this.configService.get<string>('ENCRYPTION_KEY');
    if (!encryptionKey) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }
    
    // Ensure key is 32 bytes for AES-256
    this.key = crypto.scryptSync(encryptionKey, 'user-service-salt', 32);
  }

  /**
   * Encrypts sensitive data using AES-256-GCM
   * @param text - Plain text to encrypt
   * @returns Encrypted data with IV and authentication tag
   */
  encrypt(text: string): EncryptedData {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
      cipher.setAAD(Buffer.from('user-service-preferences'));
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();
      
      return {
        encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex')
      };
    } catch (error) {
      this.logger.error('Failed to encrypt data', error);
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypts data encrypted with encrypt method
   * @param encryptedData - Data to decrypt
   * @returns Decrypted plain text
   */
  decrypt(encryptedData: EncryptedData): string {
    try {
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAAD(Buffer.from('user-service-preferences'));
      decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));
      
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      this.logger.error('Failed to decrypt data', error);
      throw new Error('Decryption failed');
    }
  }

  /**
   * Encrypts JSON object to encrypted string
   * @param data - Object to encrypt
   * @returns Encrypted data as string
   */
  encryptObject<T>(data: T): string {
    const jsonString = JSON.stringify(data);
    const encrypted = this.encrypt(jsonString);
    return JSON.stringify(encrypted);
  }

  /**
   * Decrypts encrypted string back to JSON object
   * @param encryptedString - Encrypted data as string
   * @returns Decrypted object
   */
  decryptObject<T>(encryptedString: string): T {
    const encryptedData: EncryptedData = JSON.parse(encryptedString);
    const decryptedString = this.decrypt(encryptedData);
    return JSON.parse(decryptedString);
  }

  /**
   * Safely encrypts data, returns null if input is null/undefined
   * @param data - Data to encrypt
   * @returns Encrypted string or null
   */
  safeEncryptObject<T>(data: T | null | undefined): string | null {
    if (data === null || data === undefined) {
      return null;
    }
    return this.encryptObject(data);
  }

  /**
   * Safely decrypts data, returns null if input is null/undefined
   * @param encryptedString - Encrypted string
   * @returns Decrypted object or null
   */
  safeDecryptObject<T>(encryptedString: string | null | undefined): T | null {
    if (!encryptedString) {
      return null;
    }
    try {
      return this.decryptObject<T>(encryptedString);
    } catch (error) {
      this.logger.warn('Failed to decrypt data, returning null', error);
      return null;
    }
  }
}