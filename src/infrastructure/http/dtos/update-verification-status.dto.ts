import { IsEnum } from 'class-validator';
import { VerificationStatus } from '../../../application/events/types/verification-status.enum';

export class UpdateVerificationStatusDto {
  @IsEnum(VerificationStatus)
  status: VerificationStatus;
}
