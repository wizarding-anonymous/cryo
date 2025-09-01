import { Controller, Post, Get, Put, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { BasicPublisherService } from '../../../application/services/basic-publisher.service';
import { CreatePublisherProfileDto } from '../../../application/services/dtos/create-publisher-profile.dto';
import { UpdatePublisherVerificationDto } from '../dtos/update-publisher-verification.dto';
import { BasicPublisherProfileDto } from '../dtos/basic-publisher-profile.dto';

@ApiTags('Publisher Profiles')
@Controller('publishers')
export class BasicPublisherController {
  constructor(private readonly publisherService: BasicPublisherService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new basic publisher profile' })
  createProfile(@Body() createProfileDto: CreatePublisherProfileDto) {
    return this.publisherService.createBasicPublisherProfile(createProfileDto);
  }

  @Get(':userId/basic-profile')
  @ApiOperation({ summary: 'Get basic publisher profile for integration' })
  @ApiParam({ name: 'userId', description: 'User ID', type: 'string' })
  @ApiResponse({ status: 200, description: 'Basic publisher profile data', type: BasicPublisherProfileDto })
  @ApiResponse({ status: 404, description: 'Publisher profile not found' })
  getProfile(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.publisherService.getBasicProfileByUserId(userId);
  }

  @Put(':userId/basic-profile')
  @ApiOperation({ summary: 'Update a basic publisher profile' })
  updateProfile(@Param('userId', ParseUUIDPipe) userId: string, @Body() updates: Partial<CreatePublisherProfileDto>) {
    return this.publisherService.updateBasicPublisherProfile(userId, updates);
  }

  @Get(':userId/verification-status')
  @ApiOperation({ summary: 'Get publisher verification status' })
  @ApiParam({ name: 'userId', description: 'User ID', type: 'string' })
  @ApiResponse({ status: 200, description: 'Verification status object' })
  async getVerificationStatus(@Param('userId', ParseUUIDPipe) userId: string) {
    const profile = await this.publisherService.getBasicProfileByUserId(userId);
    return profile.verification;
  }

  @Put(':userId/verification-status')
  @ApiOperation({ summary: 'Update publisher verification status (for internal/admin use)' })
  updateVerificationStatus(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() { status }: UpdatePublisherVerificationDto,
  ) {
    return this.publisherService.updateVerificationStatus(userId, status);
  }
}
