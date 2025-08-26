import { Injectable, UnauthorizedException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { User } from '../../domain/entities/user.entity';
import { SocialAccount } from '../../domain/entities/social-account.entity';
import { Email } from '../../domain/value-objects/email.value-object';
import { Password } from '../../domain/value-objects/password.value-object';
import { Username } from '../../domain/value-objects/username.value-object';

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
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(email: Email, plainPassword: string): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.userRepository.findOneBy({ email: email.getValue() });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials or inactive account');
    }

    const passwordVO = Password.fromHash(user.passwordHash);
    const isPasswordCorrect = await passwordVO.compare(plainPassword);

    if (!isPasswordCorrect) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const { passwordHash, ...result } = user;
    return result;
  }

  async login(user: Pick<User, 'id' | 'username'>): Promise<{ accessToken: string }> {
    const payload = { username: user.username, sub: user.id };
    return {
      accessToken: this.jwtService.sign(payload),
    };
  }

  async loginOrRegisterOAuth(oauthData: OAuthUserData): Promise<{ accessToken: string }> {
    const socialAccount = await this.socialAccountRepository.findOne({
        where: { provider: oauthData.provider, providerId: oauthData.providerId },
        relations: ['user'],
    });

    // Case 1: Social account already exists, log in the user
    if (socialAccount) {
        if (!socialAccount.user) {
            throw new InternalServerErrorException('Social account is not linked to a user');
        }
        return this.login(socialAccount.user);
    }

    // Case 2: No social account, check if user with this email exists
    const existingUser = await this.userRepository.findOneBy({ email: oauthData.email });
    if (existingUser) {
        // Link social account to existing user
        const newSocialAccount = this.socialAccountRepository.create({
            provider: oauthData.provider,
            providerId: oauthData.providerId,
            user: existingUser,
        });
        await this.socialAccountRepository.save(newSocialAccount);
        return this.login(existingUser);
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
        providerId: oauthData.providerId,
        user: savedUser,
    });
    await this.socialAccountRepository.save(newSocialAccount);

    return this.login(savedUser);
  }

  async refreshToken(userId: string): Promise<{ accessToken: string }> {
    // In a real implementation, we would validate a refresh token here.
    // For now, we'll just re-issue an access token for the given user ID.
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return this.login(user);
  }
}
