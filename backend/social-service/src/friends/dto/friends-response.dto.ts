import { ApiProperty } from '@nestjs/swagger';
import { FriendDto } from './friend.dto';
import { PaginationDto } from '../../common/dto';

export class FriendsResponseDto {
  @ApiProperty({
    type: [FriendDto],
    description: 'List of friends',
  })
  friends!: FriendDto[];

  @ApiProperty({
    type: () => PaginationDto,
    description: 'Pagination information',
  })
  pagination!: PaginationDto;
}
