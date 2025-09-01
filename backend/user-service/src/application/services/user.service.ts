import { Injectable, Inject, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../domain/entities/user.entity';
import { IEmailService } from '../../domain/interfaces/email.interface';
import { ISocialServiceIntegration } from '../../domain/interfaces/social-service.interface';
import { UserTokenService } from './user-token.service';
import { EventPublisher } from '../events/event-publisher.service';
import { CreateUserDto } from './dtos/create-user.dto';
import { Email } from '../../domain/value-objects/email.value-object';
import { Username } from '../../domain/value-objects/username.value-object';
import { Password } from '../../domain/value-objects/password.value-object';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @Inject(IEmailService) private readonly emailService: IEmailService,
    @Inject(ISocialServiceIntegration) private readonly socialService: ISocialServiceIntegration,
    private readonly tokenService: UserTokenService,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async createUser(createUserDto: CreateUserDto & { referralCode?: string }): Promise<User> {
    const { email, username, password, referralCode } = createUserDto;

    const emailVO = new Email(email);
    const usernameVO = new Username(username);

    const existingByEmail = await this.userRepository.findOneBy({ email: emailVO.getValue() });
    if (existingByEmail) {
      throw new ConflictException('User with this email already exists');
    }

    const existingByUsername = await this.userRepository.findOneBy({ username: usernameVO.getValue() });
    if (existingByUsername) {
      throw new ConflictException('User with this username already exists');
    }

    const passwordVO = await Password.create(password);

    const newUser = this.userRepository.create({
      email: emailVO.getValue(),
      username: usernameVO.getValue(),
      passwordHash: passwordVO.getValue(),
      isActive: false,
      emailVerified: false,
    });

    const savedUser = await this.userRepository.save(newUser);

    const activationToken = await this.tokenService.generateToken(savedUser.id, 'activation');
    await this.emailService.sendVerificationEmail(savedUser.email, activationToken);

    // Интеграция с Social Service
    await this.socialService.notifyUserRegistered({
      userId: savedUser.id,
      email: savedUser.email,
      username: savedUser.username,
      registrationDate: savedUser.createdAt,
      source: 'direct',
      referralCode,
    });

    return savedUser;
  }

  async updatePassword(userId: string, plainPassword: string): Promise<void> {
    const passwordVO = await Password.create(plainPassword);
    await this.userRepository.update(userId, { passwordHash: passwordVO.getValue() });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOneBy({ email });
  }

  async updateAvatarUrl(userId: string, avatarUrl: string): Promise<void> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      // Or throw a NotFoundException
      return;
    }
    const newProfile = { ...(user.profile as object), avatarUrl };
    await this.userRepository.update(userId, { profile: newProfile });

    // Уведомляем Social Service об обновлении профиля
    await this.socialService.notifyUserProfileUpdated({
      userId,
      displayName: (newProfile as any).displayName || user.username,
      avatarUrl,
      changedFields: ['avatarUrl'],
      timestamp: new Date(),
    });
  }

  async updateProfile(userId: string, profileData: any): Promise<void> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      return;
    }

    const oldProfile = (user.profile as any) || {};
    const newProfile = { ...oldProfile, ...profileData };

    await this.userRepository.update(userId, { profile: newProfile });

    // Определяем измененные поля
    const changedFields = Object.keys(profileData);

    // Уведомляем Social Service об обновлении профиля
    await this.socialService.notifyUserProfileUpdated({
      userId,
      displayName: newProfile.displayName || user.username,
      avatarUrl: newProfile.avatarUrl,
      changedFields,
      timestamp: new Date(),
    });
  }
}
