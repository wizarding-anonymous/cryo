import { ApiProperty } from '@nestjs/swagger';
import { LibraryGameDto } from './library-game.dto';
import { PaginationMetaDto } from '../../common/dto';

export class LibraryResponseDto {
  @ApiProperty({
    description: 'List of games in library',
    type: [LibraryGameDto],
  })
  games!: LibraryGameDto[];

  @ApiProperty({
    description: 'Pagination information',
    type: PaginationMetaDto,
  })
  pagination!: PaginationMetaDto;
}
