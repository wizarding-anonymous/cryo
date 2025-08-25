import { Controller, Post, Get, Put, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { BasicPublisherService } from '../../../application/services/basic-publisher.service';
import { CreatePublisherProfileDto } from '../../../application/services/dtos/create-publisher-profile.dto';
import { UpdatePublisherVerificationDto } from '../dtos/update-publisher-verification.dto';

@Controller('publishers')
export class BasicPublisherController {
  constructor(private readonly publisherService: BasicPublisherService) {}

  @Post()
  createProfile(@Body() createProfileDto: CreatePublisherProfileDto) {
    return this.publisherService.createBasicPublisherProfile(createProfileDto);
  }

  @Get(':userId/basic-profile')
  getProfile(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.publisherService.getBasicProfileByUserId(userId);
  }

  @Put(':userId/basic-profile')
  updateProfile(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() updates: Partial<CreatePublisherProfileDto>,
  ) {
    return this.publisherService.updateBasicPublisherProfile(userId, updates);
  }

  @Get(':userId/verification-status')
  async getVerificationStatus(@Param('userId', ParseUUIDPipe) userId: string) {
    const profile = await this.publisherService.getBasicProfileByUserId(userId);
    return profile.verification;
  }

  @Put(':userId/verification-status')
  updateVerificationStatus(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() { status }: UpdatePublisherVerificationDto,
  ) {
    return this.publisherService.updateVerificationStatus(userId, status);
  }
}
