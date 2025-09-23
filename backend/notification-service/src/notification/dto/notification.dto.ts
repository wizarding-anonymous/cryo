import { ApiProperty } from '@nestjs/swagger';
import {
  NotificationChannel,
  NotificationPriority,
  NotificationType,
} from '../../common/enums';

export class NotificationDto {
  @ApiProperty({ description: 'The unique ID of the notification' })
  id: string;

  @ApiProperty({ description: 'The ID of the user who owns the notification' })
  userId: string;

  @ApiProperty({ enum: NotificationType, description: 'The type of the notification' })
  type: NotificationType;

  @ApiProperty({ description: 'The title of the notification' })
  title: string;

  @ApiProperty({ description: 'The message body of the notification' })
  message: string;

  @ApiProperty({ description: 'Indicates if the notification has been read' })
  isRead: boolean;

  @ApiProperty({ enum: NotificationPriority, description: 'The priority of the notification' })
  priority: NotificationPriority;

  @ApiProperty({ required: false, description: 'Optional metadata' })
  metadata?: Record<string, any>;

  @ApiProperty({ type: [String], enum: NotificationChannel, required: false, description: 'Delivery channels' })
  channels?: NotificationChannel[];

  @ApiProperty({ description: 'The date the notification was created' })
  createdAt: Date;
}
