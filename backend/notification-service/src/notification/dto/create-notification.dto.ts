import {
  IsArray,
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  NotificationChannel,
  NotificationPriority,
  NotificationType,
} from '../../common/enums';

export class CreateNotificationDto {
  @IsUUID()
  @ApiProperty({
    description: 'The ID of the user to notify',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  userId!: string;

  @IsEnum(NotificationType)
  @ApiProperty({
    description: 'The type of the notification',
    enum: NotificationType,
    example: NotificationType.FRIEND_REQUEST,
  })
  type!: NotificationType;

  @IsString()
  @MaxLength(200)
  @ApiProperty({
    description: 'The title of the notification',
    example: 'New Friend Request',
  })
  title!: string;

  @IsString()
  @MaxLength(1000)
  @ApiProperty({
    description: 'The main message body of the notification',
    example: 'User John Doe wants to be your friend.',
  })
  message!: string;

  @IsEnum(NotificationPriority)
  @IsOptional()
  @ApiProperty({
    description: 'The priority of the notification',
    enum: NotificationPriority,
    required: false,
    default: NotificationPriority.NORMAL,
  })
  priority?: NotificationPriority;

  @IsArray()
  @IsEnum(NotificationChannel, { each: true })
  @IsOptional()
  @ApiProperty({
    description: 'The channels to send the notification through',
    enum: NotificationChannel,
    isArray: true,
    required: false,
    example: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
  })
  channels?: NotificationChannel[];

  @IsObject()
  @IsOptional()
  @ApiProperty({
    description: 'Optional metadata for the notification',
    required: false,
    example: { friendRequestId: 'some-uuid' },
  })
  metadata?: Record<string, any>;

  @IsDateString()
  @IsOptional()
  @ApiProperty({
    description: 'Optional expiration date for the notification',
    required: false,
  })
  expiresAt?: Date;
}
