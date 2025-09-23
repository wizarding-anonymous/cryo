import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, scryptSync, randomBytes } from 'crypto';

@Injectable()
export class EncryptionService implements OnModuleInit {
  private key!: Buffer;
  private readonly algorithm = 'aes-256-gcm';

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const secret = this.config.get<string>('ENCRYPTION_KEY');
    if (!secret) {
      throw new Error('ENCRYPTION_KEY is not set in environment variables');
    }
    // Use scrypt to derive a more secure key from the environment variable
    this.key = scryptSync(secret, 'salt', 32);
  }

  encrypt(data?: Record<string, unknown> | null): string | null {
    if (data === null || data === undefined) return null;

    const text = JSON.stringify(data);
    const iv = randomBytes(16);
    const cipher = createCipheriv(this.algorithm, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Return iv, authTag, and encrypted data as a single string
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  decrypt(encryptedText: string | null): Record<string, unknown> | null {
    if (encryptedText === null || encryptedText === undefined) return null;

    try {
      const parts = encryptedText.split(':');
      if (parts.length !== 3) {
        // Not in the expected format, return as is or handle error
        return { error: 'decryption_failed', original: encryptedText };
      }
      const [ivHex, authTagHex, encryptedHex] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const encrypted = Buffer.from(encryptedHex, 'hex');

      const decipher = createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

      return JSON.parse(decrypted.toString('utf8'));
    } catch (error: any) {
      // Handle decryption error, e.g., log it and return an error object
      return { error: 'decryption_failed', reason: error.message };
    }
  }
}
