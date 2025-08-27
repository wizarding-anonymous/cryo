import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MockGOSTEncryptionService {
  private readonly logger = new Logger(MockGOSTEncryptionService.name);

  async encryptPersonalData(data: any): Promise<string> {
    this.logger.log(`🔐 Encrypting personal data using GOST R 34.12-2015 (Kuznechik)`);
    const mockEncrypted = Buffer.from(JSON.stringify(data)).toString('base64');
    return `GOST_ENCRYPTED:${mockEncrypted}`;
  }

  async decryptPersonalData(encryptedData: string): Promise<any> {
    this.logger.log(`🔓 Decrypting data using GOST R 34.12-2015`);
    if (!encryptedData.startsWith('GOST_ENCRYPTED:')) {
      throw new Error('Invalid GOST encrypted data format');
    }
    const base64Data = encryptedData.replace('GOST_ENCRYPTED:', '');
    const decrypted = Buffer.from(base64Data, 'base64').toString('utf-8');
    return JSON.parse(decrypted);
  }
}
