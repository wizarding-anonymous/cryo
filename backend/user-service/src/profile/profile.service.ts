import { Injectable, NotFoundException } from '@nestjs/common';
import { UpdateProfileDto } from '../user/dto/update-profile.dto';
import { UserService } from '../user/user.service';
import { User } from '../user/entities/user.entity';

@Injectable()
export class ProfileService {
  constructor(private readonly userService: UserService) {}

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
    return user; // UserService.findById already returns user without password
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
    return await this.userService.updateProfile(id, updateProfileDto); // UserService.updateProfile already returns user without password
  }

  /**
   * Deletes a user's profile and account.
   * @param id - The ID of the user to delete.
   */
  async deleteProfile(id: string): Promise<void> {
    await this.userService.delete(id);
  }
}
