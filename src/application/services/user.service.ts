import { Injectable, Inject, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../domain/entities/user.entity';
import { IEmailService } from '../../domain/interfaces/email.interface';
import { UserTokenService } from './user-token.service';
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
    private readonly tokenService: UserTokenService,
  ) {}

  async createUser(createUserDto: CreateUserDto): Promise<User> {
    const { email, username, password } = createUserDto;

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
  }
}
