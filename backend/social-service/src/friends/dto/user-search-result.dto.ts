import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserSearchResultDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  username: string;

  @ApiPropertyOptional()
  avatar?: string;
}
