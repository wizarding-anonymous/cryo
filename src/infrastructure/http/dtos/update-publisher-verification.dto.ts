import { IsEnum } from 'class-validator';
import { VerificationStatus } from '../../../application/events/types/verification-status.enum';

export class UpdatePublisherVerificationDto {
  @IsEnum(VerificationStatus)
  status: VerificationStatus;
}
