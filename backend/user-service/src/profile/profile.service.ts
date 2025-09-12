import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { UpdateProfileDto } from '../user/dto/update-profile.dto';
import { UserService } from '../user/user.service';

@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly userService: UserService,
  ) {}

  /**
   * Gets a user's profile.
   * @param id - The UUID of the user to find.
   * @returns The user if found, excluding the password.
   * @throws NotFoundException if the user does not exist.
   */
  async getProfile(id: string): Promise<Omit<User, 'password'>> {
    const user = await this.userService.findById(id);
    if (!user) {
      throw new NotFoundException(`Пользователь с ID ${id} не найден`);
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...result } = user;
    return result;
  }

  /**
   * Updates a user's profile information.
   * @param id - The ID of the user to update.
   * @param updateProfileDto - The data to update.
   * @returns The updated user, excluding the password.
   * @throws NotFoundException if the user does not exist.
   */
  async updateProfile(
    id: string,
    updateProfileDto: UpdateProfileDto,
  ): Promise<Omit<User, 'password'>> {
    const userToUpdate = await this.userRepository.preload({
      id: id,
      ...updateProfileDto,
    });

    if (!userToUpdate) {
      throw new NotFoundException(`Пользователь с ID ${id} не найден`);
    }

    const savedUser = await this.userRepository.save(userToUpdate);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...result } = savedUser;
    return result;
  }

  /**
   * Deletes a user's profile and account.
   * @param id - The ID of the user to delete.
   */
  async deleteProfile(id: string): Promise<void> {
    await this.userService.delete(id);
  }
}
