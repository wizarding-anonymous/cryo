import { IsString, IsUUID, IsDateString, IsEnum, IsOptional } from 'class-validator';

export enum PublisherVerificationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export class PublisherVerificationChangedEvent {
  @IsUUID()
  userId: string;

  @IsUUID()
  publisherId: string;

  @IsEnum(PublisherVerificationStatus)
  oldStatus: PublisherVerificationStatus;

  @IsEnum(PublisherVerificationStatus)
  newStatus: PublisherVerificationStatus;

  @IsOptional()
  @IsDateString()
  verifiedAt?: string;

  @IsDateString()
  timestamp: string;

  @IsOptional()
  @IsString()
  reason?: string;

  constructor(data: Partial<PublisherVerificationChangedEvent>) {
    Object.assign(this, data);
  }
}