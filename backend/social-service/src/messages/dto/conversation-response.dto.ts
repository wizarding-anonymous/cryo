import { ApiProperty } from '@nestjs/swagger';
import { MessageDto } from './message.dto';
import { PaginationDto } from '../../common/dto';

export class ConversationResponseDto {
  @ApiProperty({
    type: [MessageDto],
    description: 'List of messages in the conversation',
  })
  messages!: MessageDto[];

  @ApiProperty({
    type: () => PaginationDto,
    description: 'Pagination information',
  })
  pagination!: PaginationDto;
}
