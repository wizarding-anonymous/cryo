import { IsString, IsUUID, IsDateString, IsEnum, IsOptional } from 'class-validator';

export enum VerificationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export class DeveloperVerificationChangedEvent {
  @IsUUID()
  userId: string;

  @IsUUID()
  developerId: string;

  @IsEnum(VerificationStatus)
  oldStatus: VerificationStatus;

  @IsEnum(VerificationStatus)
  newStatus: VerificationStatus;

  @IsOptional()
  @IsDateString()
  verifiedAt?: string;

  @IsDateString()
  timestamp: string;

  @IsOptional()
  @IsString()
  reason?: string;

  constructor(data: Partial<DeveloperVerificationChangedEvent>) {
    Object.assign(this, data);
  }
}