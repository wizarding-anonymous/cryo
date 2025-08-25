import { Controller, Post, Body } from '@nestjs/common';
import { VerificationService } from '../../../application/services/verification.service';
import { SubmitVerificationDto } from '../dtos/submit-verification.dto';

@Controller('verification')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Post('submit')
  submitForVerification(@Body() submitDto: SubmitVerificationDto) {
    const { userId, documents, profileType } = submitDto;
    return this.verificationService.submitForVerification(userId, documents, profileType);
  }
}
