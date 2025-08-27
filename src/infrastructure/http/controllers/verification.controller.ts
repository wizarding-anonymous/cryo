import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { VerificationService } from '../../../application/services/verification.service';
import { SubmitVerificationDto } from '../dtos/submit-verification.dto';
import { VerificationState } from '../../../application/services/types/verification.types';

@ApiTags('Verification')
@Controller('verification')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Post('submit')
  @ApiOperation({ summary: 'Submit documents for verification' })
  @ApiResponse({ status: 201, description: 'Verification process started, returns the resulting state.', enum: VerificationState })
  submitForVerification(@Body() submitDto: SubmitVerificationDto) {
    const { userId, documents, profileType } = submitDto;
    return this.verificationService.submitForVerification(userId, documents, profileType);
  }
}
