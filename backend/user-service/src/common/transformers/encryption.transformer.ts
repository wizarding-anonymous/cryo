import { ValueTransformer } from 'typeorm';
import { EncryptionService } from '../services/encryption.service';

/**
 * TypeORM transformer for automatic encryption/decryption of sensitive data
 */
export class EncryptionTransformer implements ValueTransformer {
  constructor(private readonly encryptionService: EncryptionService) {}

  /**
   * Transforms data before saving to database (encrypts)
   */
  to(value: any): string | null {
    return this.encryptionService.safeEncryptObject(value);
  }

  /**
   * Transforms data after loading from database (decrypts)
   */
  from(value: string | null): any {
    return this.encryptionService.safeDecryptObject(value);
  }
}

/**
 * Factory function to create encryption transformer instances
 */
export const createEncryptionTransformer = (encryptionService: EncryptionService) => {
  return new EncryptionTransformer(encryptionService);
};