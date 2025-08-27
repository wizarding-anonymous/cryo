import { IsUUID, IsString, IsDateString } from 'class-validator';

export class UserBlockedEvent {
  @IsUUID()
  userId: string;

  @IsString()
  reason: string;

  @IsUUID()
  blockedBy: string;

  @IsDateString()
  timestamp: string;
}
