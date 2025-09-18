import { ApiProperty } from '@nestjs/swagger';
import { MessageDto } from './message.dto';

class PaginationDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  totalPages!: number;
}

export class ConversationResponseDto {
  @ApiProperty({ type: [MessageDto] })
  messages!: MessageDto[];

  @ApiProperty({ type: () => PaginationDto })
  pagination!: PaginationDto;
}
