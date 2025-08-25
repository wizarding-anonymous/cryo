import { Controller, Post, Get, Put, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { BasicDeveloperService } from '../../../application/services/basic-developer.service';
import { CreateDeveloperProfileDto } from '../../../application/services/dtos/create-developer-profile.dto';
import { UpdateVerificationStatusDto } from '../dtos/update-verification-status.dto';
import { BasicDeveloperProfileDto } from '../dtos/basic-developer-profile.dto';

@ApiTags('Developer Profiles')
@Controller('developers')
export class BasicDeveloperController {
  constructor(private readonly developerService: BasicDeveloperService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new basic developer profile' })
  createProfile(@Body() createProfileDto: CreateDeveloperProfileDto) {
    // In a real app, the userId would likely come from the authenticated user (e.g., JWT)
    // For this service, we'll assume it's passed in the body for now.
    return this.developerService.createBasicDeveloperProfile(createProfileDto);
  }

  @Get(':userId/basic-profile')
  @ApiOperation({ summary: 'Get basic developer profile for integration' })
  @ApiParam({ name: 'userId', description: 'User ID', type: 'string' })
  @ApiResponse({ status: 200, description: 'Basic developer profile data', type: BasicDeveloperProfileDto })
  @ApiResponse({ status: 404, description: 'Developer profile not found' })
  getProfile(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.developerService.getBasicProfileByUserId(userId);
  }

  @Put(':userId/basic-profile')
  @ApiOperation({ summary: 'Update a basic developer profile' })
  updateProfile(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() updates: Partial<CreateDeveloperProfileDto>,
  ) {
    return this.developerService.updateBasicDeveloperProfile(userId, updates);
  }

  @Get(':userId/verification-status')
  @ApiOperation({ summary: 'Get developer verification status' })
  @ApiParam({ name: 'userId', description: 'User ID', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Verification status information',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['pending', 'approved', 'rejected'] },
        isVerified: { type: 'boolean' },
      }
    }
  })
  async getVerificationStatus(@Param('userId', ParseUUIDPipe) userId: string) {
    const profile = await this.developerService.getBasicProfileByUserId(userId);
    return {
      status: profile.verificationStatus,
      isVerified: profile.isVerified,
    };
  }

  @Put(':userId/verification-status')
  @ApiOperation({ summary: 'Update developer verification status (for internal/admin use)' })
  updateVerificationStatus(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() { status }: UpdateVerificationStatusDto,
  ) {
    return this.developerService.updateVerificationStatus(userId, status);
  }
}
