import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserSearchResultDto {
  @ApiProperty({
    description: 'Unique identifier of the user',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  id!: string;

  @ApiProperty({
    description: 'Username of the user',
    example: 'john_doe',
  })
  username!: string;

  @ApiPropertyOptional({
    description: 'Avatar URL of the user',
    example: 'https://example.com/avatar.jpg',
  })
  avatar?: string;
}
