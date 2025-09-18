import { ApiProperty } from '@nestjs/swagger';
import { FriendDto } from './friend.dto';

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

export class FriendsResponseDto {
  @ApiProperty({ type: [FriendDto] })
  friends!: FriendDto[];

  @ApiProperty({ type: () => PaginationDto })
  pagination!: PaginationDto;
}
