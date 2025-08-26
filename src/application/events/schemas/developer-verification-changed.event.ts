import { IsUUID, IsEnum, IsDateString } from 'class-validator';
import { VerificationStatus } from '../types/verification-status.enum';

export class DeveloperVerificationChangedEvent {
  @IsUUID()
  userId: string;

  @IsUUID()
  developerId: string;

  @IsEnum(VerificationStatus)
  newStatus: VerificationStatus;

  @IsDateString()
  timestamp: string;
}
