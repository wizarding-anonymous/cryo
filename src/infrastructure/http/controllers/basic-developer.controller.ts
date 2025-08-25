import { Controller, Post, Get, Put, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { BasicDeveloperService } from '../../../application/services/basic-developer.service';
import { CreateDeveloperProfileDto } from '../../../application/services/dtos/create-developer-profile.dto';
import { UpdateVerificationStatusDto } from '../dtos/update-verification-status.dto';

@Controller('developers')
export class BasicDeveloperController {
  constructor(private readonly developerService: BasicDeveloperService) {}

  @Post()
  createProfile(@Body() createProfileDto: CreateDeveloperProfileDto) {
    // In a real app, the userId would likely come from the authenticated user (e.g., JWT)
    // For this service, we'll assume it's passed in the body for now.
    return this.developerService.createBasicDeveloperProfile(createProfileDto);
  }

  @Get(':userId/basic-profile')
  getProfile(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.developerService.getBasicProfileByUserId(userId);
  }

  @Put(':userId/basic-profile')
  updateProfile(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() updates: Partial<CreateDeveloperProfileDto>,
  ) {
    return this.developerService.updateBasicDeveloperProfile(userId, updates);
  }

  @Get(':userId/verification-status')
  async getVerificationStatus(@Param('userId', ParseUUIDPipe) userId: string) {
    const profile = await this.developerService.getBasicProfileByUserId(userId);
    return {
      status: profile.verificationStatus,
      isVerified: profile.isVerified,
    };
  }

  @Put(':userId/verification-status')
  updateVerificationStatus(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() { status }: UpdateVerificationStatusDto,
  ) {
    return this.developerService.updateVerificationStatus(userId, status);
  }
}
