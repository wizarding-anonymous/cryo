import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
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
    return this.userRepository.save(newUser);
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
   * Updates a user's profile information.
   * @param id - The ID of the user to update.
   * @param updateProfileDto - The data to update.
   * @returns The updated user.
   * @throws NotFoundException if the user does not exist.
   */
  async updateProfile(
    id: string,
    updateProfileDto: UpdateProfileDto,
  ): Promise<User> {
    const userToUpdate = await this.userRepository.preload({
      id: id,
      ...updateProfileDto,
    });

    if (!userToUpdate) {
      throw new NotFoundException(`Пользователь с ID ${id} не найден`);
    }

    return this.userRepository.save(userToUpdate);
  }
}
