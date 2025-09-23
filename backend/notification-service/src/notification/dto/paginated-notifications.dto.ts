import { ApiProperty } from '@nestjs/swagger';
import { NotificationDto } from './notification.dto';

export class PaginatedNotificationsDto {
  @ApiProperty({
    type: [NotificationDto],
    description: 'The list of notifications for the current page',
  })
  data!: NotificationDto[];

  @ApiProperty({ description: 'The total number of notifications available' })
  total!: number;

  @ApiProperty({ description: 'The number of items requested per page' })
  limit!: number;

  @ApiProperty({ description: 'The number of items skipped' })
  offset!: number;
}
