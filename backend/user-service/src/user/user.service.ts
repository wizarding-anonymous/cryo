import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { SecurityClient } from '../integrations/security/security.client';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly securityClient: SecurityClient,
  ) {}

  /**
   * Hashes a plain text password using bcrypt.
   * @param password The plain text password to hash.
   * @returns A promise that resolves to the hashed password.
   */
  private async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Creates a new user in the database.
   * Hashes the password before saving.
   * @param createUserDto - The data to create a user.
   * @returns The newly created user.
   */
  async create(createUserDto: CreateUserDto): Promise<User> {
    const { name, email, password } = createUserDto;

    const hashedPassword = await this.hashPassword(password);

    const newUser = this.userRepository.create({
      name,
      email,
      password: hashedPassword,
    });

    const savedUser = await this.userRepository.save(newUser);

    // Log a security event for the new user creation.
    void this.securityClient.logSecurityEvent({
      userId: savedUser.id,
      type: 'USER_REGISTRATION', // A custom type for this event
      ipAddress: '::1', // Mock IP address for now
      timestamp: new Date(),
    });

    return savedUser;
  }

  /**
   * Finds a user by their email address.
   * @param email - The email of the user to find.
   * @returns The user if found, otherwise null.
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  /**
   * Finds a user by their ID.
   * @param id - The UUID of the user to find.
   * @returns The user if found, otherwise null.
   */
  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  /**
   * Deletes a user from the database.
   * @param id - The ID of the user to delete.
   * @returns A promise that resolves when the user is deleted.
   * @throws NotFoundException if the user does not exist.
   */
  async delete(id: string): Promise<void> {
    const result = await this.userRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Пользователь с ID ${id} не найден`);
    }
  }
}
