import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../domain/entities/user.entity';
import { UserToken } from '../../domain/entities/user-token.entity';
import { authenticator } from 'otplib';
import * as qrcode from 'qrcode';
import { randomBytes } from 'crypto';
import { EventPublisher } from '../events/event-publisher.service';

export interface MfaSetupResult {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
  backupCodes: string[];
}

export interface MfaMethod {
  type: 'totp' | 'sms' | 'push';
  enabled: boolean;
  setupAt?: Date;
}

@Injectable()
export class MfaService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserToken)
    private readonly userTokenRepository: Repository<UserToken>,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async enableTotpMfa(userId: string, email: string): Promise<MfaSetupResult> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(email, 'Russian Gaming Platform', secret);

    // Генерируем резервные коды
    const backupCodes = this.generateBackupCodes();

    // В реальной реализации secret должен быть зашифрован
    await this.userRepository.update(userId, { 
      mfaSecret: secret,
      backupCodes: backupCodes // В реальности должны быть зашифрованы
    });

    const qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl);

    return {
      secret,
      otpauthUrl,
      qrCodeDataUrl,
      backupCodes,
    };
  }

  async enableSmsMfa(userId: string, phoneNumber: string): Promise<{ success: boolean }> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Валидация номера телефона
    if (!this.isValidPhoneNumber(phoneNumber)) {
      throw new BadRequestException('Invalid phone number format');
    }

    // Отправляем SMS с кодом подтверждения
    const verificationCode = this.generateSmsCode();
    await this.sendSmsVerificationCode(phoneNumber, verificationCode);

    // Сохраняем временный токен для подтверждения SMS
    await this.createVerificationToken(userId, 'sms_verification', verificationCode);

    await this.userRepository.update(userId, { phoneNumber });

    return { success: true };
  }

  async verifySmsSetup(userId: string, code: string): Promise<{ success: boolean }> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Проверяем код из SMS
    const isValid = await this.verifySmsCode(userId, code);
    if (!isValid) {
      throw new BadRequestException('Invalid SMS verification code');
    }

    // Активируем SMS MFA
    const mfaMethods = (user.mfaMethods as MfaMethod[]) || [];
    mfaMethods.push({
      type: 'sms',
      enabled: true,
      setupAt: new Date(),
    });

    await this.userRepository.update(userId, { 
      mfaMethods,
      phoneVerified: true 
    });

    await this.eventPublisher.publish('MfaMethodEnabled', {
      userId,
      method: 'sms',
      enabledAt: new Date(),
    });

    return { success: true };
  }

  async verifyAndActivateTotpMfa(userId: string, token: string): Promise<{ success: boolean }> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user || !user.mfaSecret) {
      throw new BadRequestException('MFA setup has not been initiated for this user.');
    }

    const isValid = authenticator.verify({
      token,
      secret: user.mfaSecret,
    });

    if (!isValid) {
      throw new BadRequestException('Invalid MFA token.');
    }

    // Активируем TOTP MFA
    const mfaMethods = (user.mfaMethods as MfaMethod[]) || [];
    mfaMethods.push({
      type: 'totp',
      enabled: true,
      setupAt: new Date(),
    });

    await this.userRepository.update(userId, { 
      mfaEnabled: true,
      mfaMethods 
    });

    await this.eventPublisher.publish('MfaMethodEnabled', {
      userId,
      method: 'totp',
      enabledAt: new Date(),
    });

    return { success: true };
  }

  async verifyMfaToken(userId: string, token: string, method?: 'totp' | 'sms' | 'backup'): Promise<boolean> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Проверяем резервные коды
    if (method === 'backup' || (!method && this.isBackupCode(token))) {
      return this.verifyBackupCode(userId, token);
    }

    // Проверяем TOTP
    if ((method === 'totp' || !method) && user.mfaSecret) {
      const isValidTotp = authenticator.verify({
        token,
        secret: user.mfaSecret,
      });
      if (isValidTotp) return true;
    }

    // Проверяем SMS код
    if ((method === 'sms' || !method) && user.phoneVerified) {
      const isValidSms = await this.verifySmsCode(userId, token);
      if (isValidSms) return true;
    }

    return false;
  }

  async generateNewBackupCodes(userId: string): Promise<string[]> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const backupCodes = this.generateBackupCodes();
    
    await this.userRepository.update(userId, { 
      backupCodes // В реальности должны быть зашифрованы
    });

    await this.eventPublisher.publish('MfaBackupCodesRegenerated', {
      userId,
      regeneratedAt: new Date(),
    });

    return backupCodes;
  }

  async disableMfaMethod(userId: string, method: 'totp' | 'sms'): Promise<void> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const mfaMethods = ((user.mfaMethods as MfaMethod[]) || []).filter((m: MfaMethod) => m.type !== method);
    const mfaEnabled = mfaMethods.some((m: MfaMethod) => m.enabled);

    const updates: any = { mfaMethods };
    
    if (method === 'totp') {
      updates.mfaSecret = null;
    }
    
    if (!mfaEnabled) {
      updates.mfaEnabled = false;
      updates.backupCodes = null;
    }

    await this.userRepository.update(userId, updates);

    await this.eventPublisher.publish('MfaMethodDisabled', {
      userId,
      method,
      disabledAt: new Date(),
    });
  }

  async getMfaStatus(userId: string): Promise<{ enabled: boolean; methods: MfaMethod[] }> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      enabled: user.mfaEnabled || false,
      methods: (user.mfaMethods as MfaMethod[]) || [],
    };
  }

  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      // Генерируем 8-значные коды
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      codes.push(code);
    }
    return codes;
  }

  private generateSmsCode(): string {
    // Генерируем 6-значный код
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async sendSmsVerificationCode(phoneNumber: string, code: string): Promise<void> {
    // В реальной реализации интеграция с SMS провайдером (например, Twilio, SMS.ru)
    console.log(`SMS to ${phoneNumber}: Your verification code is ${code}`);
    
    // Отправляем событие для логирования
    await this.eventPublisher.publish('SmsVerificationSent', {
      phoneNumber,
      sentAt: new Date(),
    });
  }

  private async createVerificationToken(userId: string, type: 'sms_verification', code: string): Promise<string> {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 минут

    const userToken = this.userTokenRepository.create({
      userId,
      token,
      tokenType: type,
      expiresAt,
      isUsed: false,
      // В реальности code должен быть зашифрован
      metadata: { code },
    });

    await this.userTokenRepository.save(userToken);
    return token;
  }

  private async verifySmsCode(userId: string, code: string): Promise<boolean> {
    const userToken = await this.userTokenRepository.findOne({
      where: { 
        userId, 
        tokenType: 'sms_verification', 
        isUsed: false 
      },
      order: { createdAt: 'DESC' }
    });

    if (!userToken || userToken.expiresAt < new Date()) {
      return false;
    }

    const storedCode = userToken.metadata?.code;
    if (storedCode !== code) {
      return false;
    }

    // Отмечаем токен как использованный
    userToken.isUsed = true;
    userToken.usedAt = new Date();
    await this.userTokenRepository.save(userToken);

    return true;
  }

  private isBackupCode(token: string): boolean {
    // Резервные коды имеют определенный формат (8 символов, буквы и цифры)
    return /^[A-Z0-9]{8}$/.test(token);
  }

  private async verifyBackupCode(userId: string, code: string): Promise<boolean> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user || !user.backupCodes) {
      return false;
    }

    const backupCodes = user.backupCodes;
    const codeIndex = backupCodes.indexOf(code);
    
    if (codeIndex === -1) {
      return false;
    }

    // Удаляем использованный код
    backupCodes.splice(codeIndex, 1);
    await this.userRepository.update(userId, { backupCodes });

    await this.eventPublisher.publish('MfaBackupCodeUsed', {
      userId,
      usedAt: new Date(),
      remainingCodes: backupCodes.length,
    });

    return true;
  }

  private isValidPhoneNumber(phoneNumber: string): boolean {
    // Простая валидация российских номеров
    return /^\+7[0-9]{10}$/.test(phoneNumber);
  }
}
