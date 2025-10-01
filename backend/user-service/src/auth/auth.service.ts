import { Injectable, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserService } from '../user/user.service';
import { RegisterDto } from './dto/register.dto';
import { User } from '../user/entities/user.entity';
import { NotificationClient } from '../integrations/notification/notification.client';
import { RedisService } from '../common/redis/redis.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
    private readonly notificationClient: NotificationClient,
  ) {}

  /**
   * Registers a new user.
   * @param registerDto - The registration data.
   * @returns The newly created user and JWT tokens.
   * @throws ConflictException if the email is already in use.
   */
  async register(
    registerDto: RegisterDto,
  ): Promise<{ user: Omit<User, 'password'>; accessToken: string }> {
    const { name, email, password } = registerDto;

    // Check if user already exists
    const existingUser = await this.userService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('Пользователь с таким email уже существует');
    }

    // The UserService is now responsible for hashing and creating the user.
    const newUser = await this.userService.create({ name, email, password });

    // Send a welcome notification. This is a non-blocking call.
    void this.notificationClient.sendWelcomeNotification(
      newUser.id,
      newUser.email,
    );

    // Generate tokens and log the user in
    const tokens = await this.generateTokens(newUser);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...userWithoutPassword } = newUser;

    return {
      user: userWithoutPassword,
      accessToken: tokens.accessToken,
    };
  }

  /**
   * Validates a user based on email and password.
   * @param email - The user's email.
   * @param pass - The user's plain text password.
   * @returns The user object (without password) if validation is successful, otherwise null.
   */
  async validateUser(
    email: string,
    pass: string,
  ): Promise<Omit<User, 'password'> | null> {
    const user = await this.userService.findByEmail(email);
    if (user && (await this.comparePassword(pass, user.password))) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  /**
   * Logs a user in and returns JWT tokens and user info.
   * @param user - The user object (typically from validateUser).
   * @returns An object containing the access token and user info.
   */
  async login(user: Omit<User, 'password'>) {
    const tokens = await this.generateTokens(user as User);
    return {
      user,
      accessToken: tokens.accessToken,
    };
  }

  /**
   * Generates JWT access token for a user.
   * @param user - The user to generate tokens for.
   * @returns An object with the accessToken.
   */
  private async generateTokens(user: User): Promise<{ accessToken: string }> {
    const payload = { sub: user.id, email: user.email };
    const accessToken = await this.jwtService.signAsync(payload);
    return { accessToken };
  }

  /**
   * Compares a plain text password with a hash to see if they match.
   * This remains an auth concern for the validation step.
   * @param password The plain text password.
   * @param hash The hashed password to compare against.
   * @returns A promise that resolves to true if they match, false otherwise.
   */
  private async comparePassword(
    password: string,
    hash: string,
  ): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Logs a user out by blacklisting their JWT.
   * @param accessToken The JWT to blacklist.
   */
  async logout(accessToken: string): Promise<void> {
    const decoded = this.jwtService.decode(accessToken);
    if (!decoded || !decoded.exp) {
      return; // Token is invalid, nothing to do
    }
    const ttl = decoded.exp * 1000 - Date.now();
    if (ttl > 0) {
      await this.redisService.blacklistToken(accessToken, ttl);
    }
  }

  /**
   * Check if a JWT token is blacklisted
   * @param token JWT token to check
   * @returns true if token is blacklisted
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    return this.redisService.isTokenBlacklisted(token);
  }
}
