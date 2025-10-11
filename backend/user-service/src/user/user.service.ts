import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
   * Creates a new user in the database.
   * Password should already be hashed by auth-service.
   * Used by Auth Service during user registration process.
   * @param createUserDto - The data to create a user.
   * @returns The newly created user.
   * @throws ConflictException if user with email already exists.
   */
  async create(createUserDto: CreateUserDto): Promise<User> {
    const { name, email, password } = createUserDto;

    // Normalize email for consistency
    const normalizedEmail = email.toLowerCase().trim();

    // Check if user with this email already exists
    const existingUser = await this.userRepository.findOne({ 
      where: { email: normalizedEmail } 
    });
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Password is already hashed by auth-service
    const newUser = this.userRepository.create({
      name: name.trim(),
      email: normalizedEmail,
      password, // Already hashed
    });

    try {
      const savedUser = await this.userRepository.save(newUser);

      // Log a security event for the new user creation.
      void this.securityClient.logSecurityEvent({
        userId: savedUser.id,
        type: 'USER_REGISTRATION', // A custom type for this event
        ipAddress: '::1', // Mock IP address for now
        timestamp: new Date(),
      });

      return savedUser;
    } catch (error) {
      // Handle database constraint violations
      if (error.code === '23505') { // PostgreSQL unique violation
        throw new ConflictException('User with this email already exists');
      }
      throw error;
    }
  }

  /**
   * Finds a user by their email address.
   * Used by Auth Service for login credential verification.
   * @param email - The email of the user to find.
   * @returns The user if found, otherwise null.
   */
  async findByEmail(email: string): Promise<User | null> {
    if (!email || typeof email !== 'string') {
      return null;
    }
    
    try {
      return await this.userRepository.findOne({ 
        where: { email: email.toLowerCase().trim() } 
      });
    } catch (error) {
      // Log error but don't throw to allow graceful handling
      console.error('Error finding user by email:', error);
      return null;
    }
  }

  /**
   * Finds a user by their ID.
   * Used by Auth Service for token validation and user verification.
   * @param id - The UUID of the user to find.
   * @returns The user if found, otherwise null.
   */
  async findById(id: string): Promise<User | null> {
    if (!id || typeof id !== 'string') {
      return null;
    }
    
    try {
      return await this.userRepository.findOne({ 
        where: { id } 
      });
    } catch (error) {
      // Log error but don't throw to allow graceful handling
      console.error('Error finding user by ID:', error);
      return null;
    }
  }

  /**
   * Finds a user by their ID without password.
   * @param id - The UUID of the user to find.
   * @returns The user if found (without password), otherwise null.
   */
  async findByIdWithoutPassword(id: string): Promise<Omit<User, 'password'> | null> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Updates a user's information.
   * @param id - The ID of the user to update.
   * @param updateData - The data to update (partial user data).
   * @returns The updated user.
   * @throws NotFoundException if the user does not exist.
   * @throws ConflictException if email is already in use by another user.
   */
  async update(
    id: string,
    updateData: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<User> {
    // Check if email is being updated and if it's already in use
    if (updateData.email) {
      const existingUser = await this.findByEmail(updateData.email);
      if (existingUser && existingUser.id !== id) {
        throw new ConflictException('Email уже используется другим пользователем');
      }
    }

    // Password updates are no longer handled by User Service
    // Auth Service handles all password operations
    if (updateData.password) {
      throw new ConflictException('Password updates must be handled by Auth Service');
    }

    const userToUpdate = await this.userRepository.preload({
      id: id,
      ...updateData,
    });

    if (!userToUpdate) {
      throw new NotFoundException(`Пользователь с ID ${id} не найден`);
    }

    return this.userRepository.save(userToUpdate);
  }

  /**
   * Soft deletes a user from the database.
   * @param id - The ID of the user to delete.
   * @returns A promise that resolves when the user is deleted.
   * @throws NotFoundException if the user does not exist.
   */
  async delete(id: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`Пользователь с ID ${id} не найден`);
    }

    const result = await this.userRepository.softDelete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Пользователь с ID ${id} не найден`);
    }

    // Log security event for account deletion
    void this.securityClient.logSecurityEvent({
      userId: id,
      type: 'ACCOUNT_DELETED',
      ipAddress: '::1', // Mock IP address for now
      timestamp: new Date(),
    });
  }

  /**
   * Alias for delete method to match controller naming.
   * @param id - The ID of the user to delete.
   * @returns A promise that resolves when the user is deleted.
   */
  async deleteUser(id: string): Promise<void> {
    return this.delete(id);
  }

  /**
   * Checks if a user exists by their ID.
   * Used by Auth Service for token validation without returning sensitive data.
   * @param id - The UUID of the user to check.
   * @returns True if the user exists, false otherwise.
   */
  async exists(id: string): Promise<boolean> {
    if (!id || typeof id !== 'string') {
      return false;
    }
    
    try {
      const count = await this.userRepository.count({ 
        where: { id } 
      });
      return count > 0;
    } catch (error) {
      // Log error but don't throw to allow graceful handling
      console.error('Error checking user existence:', error);
      return false;
    }
  }

  /**
   * Updates a user's profile information.
   * @param id - The ID of the user to update.
   * @param updateData - The profile data to update.
   * @returns The updated user (without password).
   */
  async updateProfile(
    id: string,
    updateData: { name?: string },
  ): Promise<Omit<User, 'password'>> {
    const updatedUser = await this.update(id, updateData);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword;
  }



  /**
   * Updates the last login timestamp for a user.
   * Called by auth-service after successful login via event handling.
   * @param id - The ID of the user.
   * @returns Promise that resolves when last login is updated.
   * @throws NotFoundException if the user does not exist.
   */
  async updateLastLogin(id: string): Promise<void> {
    if (!id || typeof id !== 'string') {
      throw new NotFoundException('User not found');
    }

    try {
      const result = await this.userRepository.update(id, { 
        lastLoginAt: new Date() 
      });
      
      // Check if any rows were affected
      if (result.affected === 0) {
        throw new NotFoundException('User not found');
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      // Log error and re-throw as NotFoundException for consistency
      console.error('Error updating last login:', error);
      throw new NotFoundException('User not found');
    }
  }
}
