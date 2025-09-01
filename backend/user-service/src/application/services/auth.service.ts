import { Injectable, UnauthorizedException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';

import { User } from '../../domain/entities/user.entity';
import { SocialAccount } from '../../domain/entities/social-account.entity';
import { Email } from '../../domain/value-objects/email.value-object';
import { Password } from '../../domain/value-objects/password.value-object';
import { Username } from '../../domain/value-objects/username.value-object';
import { SessionService, DeviceInfo } from './session.service';

interface OAuthUserData {
  provider: string;
  providerId: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(SocialAccount)
    private readonly socialAccountRepository: Repository<SocialAccount>,
    private readonly sessionService: SessionService,
  ) {}

  async validateUser(email: Email, plainPassword: string): Promise<User> {
    const user = await this.userRepository.findOneBy({ email: email.getValue() });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials or inactive account');
    }

    const passwordVO = Password.fromHash(user.passwordHash);
    const isPasswordCorrect = await passwordVO.compare(plainPassword);

    if (!isPasswordCorrect) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }

  async login(
    user: Pick<User, 'id' | 'username'>,
    deviceInfo: DeviceInfo,
    ipAddress: string,
    userAgent: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    // Ensure deviceInfo has userAgent
    const completeDeviceInfo: DeviceInfo = {
      ...deviceInfo,
      userAgent: userAgent || deviceInfo.userAgent || 'Unknown',
    };

    const result = await this.sessionService.createSession(user.id, completeDeviceInfo, ipAddress);

    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
  }

  async loginOrRegisterOAuth(oauthData: OAuthUserData): Promise<{ accessToken: string }> {
    const socialAccount = await this.socialAccountRepository.findOne({
      where: { provider: oauthData.provider, providerUserId: oauthData.providerId },
      relations: ['user'],
    });

    // Case 1: Social account already exists, log in the user
    if (socialAccount) {
      if (!socialAccount.user) {
        throw new InternalServerErrorException('Social account is not linked to a user');
      }
      // Default device info for OAuth login
      const defaultDeviceInfo: DeviceInfo = {
        type: 'desktop',
        os: 'unknown',
        browser: 'OAuth',
        browserVersion: '1.0',
        version: '1.0',
        userAgent: 'OAuth Login',
      };
      return this.login(socialAccount.user, defaultDeviceInfo, '0.0.0.0', 'OAuth Login');
    }

    // Case 2: No social account, check if user with this email exists
    const existingUser = await this.userRepository.findOneBy({ email: oauthData.email });
    if (existingUser) {
      // Link social account to existing user
      const newSocialAccount = this.socialAccountRepository.create({
        provider: oauthData.provider,
        providerUserId: oauthData.providerId,
        user: existingUser,
      });
      await this.socialAccountRepository.save(newSocialAccount);
      // Default device info for OAuth login
      const defaultDeviceInfo: DeviceInfo = {
        type: 'desktop',
        os: 'unknown',
        browser: 'OAuth',
        browserVersion: '1.0',
        version: '1.0',
        userAgent: 'OAuth Login',
      };
      return this.login(existingUser, defaultDeviceInfo, '0.0.0.0', 'OAuth Login');
    }

    // Case 3: No user exists, create a new user and social account
    const username = new Username(oauthData.email.split('@')[0]); // Generate username from email
    const randomPassword = await Password.create(crypto.randomBytes(16).toString('hex') + 'A1a');

    const newUser = this.userRepository.create({
      email: oauthData.email,
      username: username.getValue(),
      passwordHash: randomPassword.getValue(),
      emailVerified: true, // Email is considered verified from OAuth provider
      isActive: true,
    });
    const savedUser = await this.userRepository.save(newUser);

    const newSocialAccount = this.socialAccountRepository.create({
      provider: oauthData.provider,
      providerUserId: oauthData.providerId,
      user: savedUser,
    });
    await this.socialAccountRepository.save(newSocialAccount);

    // Default device info for OAuth login
    const defaultDeviceInfo: DeviceInfo = {
      type: 'desktop',
      os: 'unknown',
      browser: 'OAuth',
      browserVersion: '1.0',
      version: '1.0',
      userAgent: 'OAuth Login',
    };
    return this.login(savedUser, defaultDeviceInfo, '0.0.0.0', 'OAuth Login');
  }

  async refreshToken(_refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    // TODO: Implement refresh token logic in SessionService
    throw new Error('Refresh token functionality not implemented yet');
  }

  async terminateSession(sessionId: string, _userId: string): Promise<void> {
    await this.sessionService.terminateSession(sessionId);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    currentSessionId?: string,
  ): Promise<void> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Verify current password
    const passwordVO = Password.fromHash(user.passwordHash);
    const isCurrentPasswordCorrect = await passwordVO.compare(currentPassword);

    if (!isCurrentPasswordCorrect) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Set new password
    const newPasswordVO = await Password.create(newPassword);
    user.passwordHash = newPasswordVO.getValue();
    await this.userRepository.save(user);

    // Terminate all sessions except current one for security
    await this.sessionService.terminateAllSessions(userId, currentSessionId);
  }
}
