import { Injectable, Inject, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../domain/entities/user.entity';
import { IEmailService } from '../../domain/interfaces/email.interface';
import { UserActivationService } from './user-activation.service';
import { CreateUserDto } from '../../infrastructure/http/dtos/create-user.dto'; // Assuming DTO is moved or created here
import { Email } from '../../domain/value-objects/email.value-object';
import { Username } from '../../domain/value-objects/username.value-object';
import { Password } from '../../domain/value-objects/password.value-object';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @Inject(IEmailService) private readonly emailService: IEmailService,
    private readonly activationService: UserActivationService,
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

    const activationToken = await this.activationService.generateActivationToken(savedUser.id);
    await this.emailService.sendVerificationEmail(savedUser.email, activationToken);

    return savedUser;
  }
}
