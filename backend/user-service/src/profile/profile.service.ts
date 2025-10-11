import { Injectable } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { UpdateProfileDto } from '../user/dto/update-profile.dto';

@Injectable()
export class ProfileService {
  constructor(private readonly userService: UserService) {}

  async getProfile(userId: string) {
    return this.userService.findById(userId);
  }

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    return this.userService.updateProfile(userId, updateProfileDto);
  }

  async deleteProfile(userId: string) {
    return this.userService.deleteUser(userId);
  }
}